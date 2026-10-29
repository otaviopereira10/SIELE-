"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/dal";
import { generateInvitationCode, hashInvitationCode } from "@/lib/auth/codes";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/exam/errors";
import { CATEGORIES } from "@/lib/diagnosis/taxonomy";
import { buildDiagnosis, generatePlan } from "@/lib/diagnosis/engine";
import type { PublishedReport } from "@/lib/results/report";
import { isAiConfigured, suggestWritingFeedback } from "@/lib/ai/feedback";
import type { WritingContent } from "@/lib/exam/content-schema";

export type ActionState = { ok: boolean; error?: string; message?: string; data?: unknown } | null;

const uuid = z.uuid();
const text = (max: number) => z.string().max(max).default("");

const scoresSchema = z.array(
  z.object({ criterion: z.string().regex(/^[a-z_]{2,40}$/), band: z.number().int().min(0).max(5).nullable(), comment: z.string().max(4000) }),
);

export async function saveEvaluation(input: {
  attemptId: string;
  taskId: string;
  scores: { criterion: string; band: number | null; comment: string }[];
  globalComment: string;
  strengths: string;
  priorities: string;
  nextSteps: string;
}): Promise<ActionState> {
  await requireStaff();
  const parsed = z
    .object({
      attemptId: uuid,
      taskId: uuid,
      scores: scoresSchema,
      globalComment: text(8000),
      strengths: text(4000),
      priorities: text(4000),
      nextSteps: text(4000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos de evaluación no válidos." };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_evaluation", {
    p_attempt: v.attemptId,
    p_task: v.taskId,
    p_scores: v.scores,
    p_global_comment: v.globalComment,
    p_strengths: v.strengths,
    p_priorities: v.priorities,
    p_next_steps: v.nextSteps,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/profesora/correcciones/${v.attemptId}`);
  return { ok: true, message: "Borrador guardado.", data };
}

const feedbackSchema = z.object({
  attemptId: uuid,
  taskId: uuid,
  kind: z.enum(["strength", "error", "suggestion"]),
  category: z.string().refine((c) => CATEGORIES.some((x) => x.key === c), "Categoría desconocida"),
  criterionKey: z.string().regex(/^[a-z_]{2,40}$/).nullable(),
  quote: text(1000),
  charStart: z.number().int().min(0).nullable(),
  charEnd: z.number().int().min(0).nullable(),
  recordingId: uuid.nullable(),
  audioMs: z.number().int().min(0).nullable(),
  explanation: text(2000),
  correction: text(1000),
  improvedExample: text(1000),
  isSystematic: z.boolean(),
  severity: z.number().int().min(1).max(3),
});

/** Añade una evidencia anotada (cita del texto o momento de la grabación). Crea la evaluación si no existe. */
export async function addFeedback(input: z.input<typeof feedbackSchema>): Promise<ActionState> {
  const profile = await requireStaff();
  const parsed = feedbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await createClient();
  let { data: ev } = await supabase.from("evaluations").select("id").eq("attempt_id", v.attemptId).eq("task_id", v.taskId).maybeSingle();
  if (!ev) {
    const { error } = await supabase.rpc("save_evaluation", { p_attempt: v.attemptId, p_task: v.taskId, p_scores: [], p_global_comment: "", p_strengths: "", p_priorities: "", p_next_steps: "" });
    if (error) return { ok: false, error: errorMessage(error) };
    ({ data: ev } = await supabase.from("evaluations").select("id").eq("attempt_id", v.attemptId).eq("task_id", v.taskId).maybeSingle());
  }
  if (!ev) return { ok: false, error: "No se pudo crear la evaluación." };
  const { error } = await supabase.from("teacher_feedback").insert({
    evaluation_id: ev.id,
    kind: v.kind,
    category: v.category,
    criterion_key: v.criterionKey,
    quote: v.quote,
    char_start: v.charStart,
    char_end: v.charEnd,
    recording_id: v.recordingId,
    audio_ms: v.audioMs,
    explanation: v.explanation,
    correction: v.correction,
    improved_example: v.improvedExample,
    is_systematic: v.isSystematic,
    severity: v.severity,
    created_by: profile.id,
  });
  if (error) return { ok: false, error: "No se pudo guardar la observación." };
  revalidatePath(`/profesora/correcciones/${v.attemptId}`);
  return { ok: true, message: "Observación añadida." };
}

export async function deleteFeedback(attemptId: string, feedbackId: string): Promise<ActionState> {
  await requireStaff();
  if (!uuid.safeParse(feedbackId).success || !uuid.safeParse(attemptId).success) return { ok: false, error: "Solicitud no válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("teacher_feedback").delete().eq("id", feedbackId);
  if (error) return { ok: false, error: "No se pudo eliminar." };
  revalidatePath(`/profesora/correcciones/${attemptId}`);
  return { ok: true };
}

export async function saveTranscript(attemptId: string, recordingId: string, transcript: string): Promise<ActionState> {
  await requireStaff();
  if (!uuid.safeParse(recordingId).success || transcript.length > 20000) return { ok: false, error: "Solicitud no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_recording_transcript", { p_recording: recordingId, p_text: transcript });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/profesora/correcciones/${attemptId}`);
  return { ok: true, message: "Transcripción guardada." };
}

export async function publishResults(attemptId: string): Promise<ActionState> {
  await requireStaff();
  if (!uuid.safeParse(attemptId).success) return { ok: false, error: "Solicitud no válida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_attempt_results", { p_attempt: attemptId });
  if (error) return { ok: false, error: errorMessage(error) };
  const res = data as { status: string; missing?: { title: string; section: string }[] };
  if (res.status === "incomplete") {
    return { ok: false, error: `Faltan evaluaciones completas en: ${(res.missing ?? []).map((m) => `${m.section} · ${m.title}`).join("; ")}.` };
  }
  revalidatePath(`/profesora/correcciones/${attemptId}`);
  revalidatePath("/profesora/correcciones");
  return { ok: true, message: "Resultados publicados. El estudiante ya puede ver el informe." };
}

export async function requestResubmission(attemptId: string, taskId: string, reason: string): Promise<ActionState> {
  await requireStaff();
  if (!uuid.safeParse(attemptId).success || !uuid.safeParse(taskId).success) return { ok: false, error: "Solicitud no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_resubmission", { p_attempt: attemptId, p_task: taskId, p_reason: reason.slice(0, 2000) });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/profesora/correcciones/${attemptId}`);
  return { ok: true, message: "Se ha solicitado una nueva entrega." };
}

export async function setAttemptLock(attemptId: string, locked: boolean): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_attempt_lock", { p_attempt: attemptId, p_locked: locked });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/profesora/correcciones/${attemptId}`);
  return { ok: true, message: locked ? "Intento bloqueado." : "Intento desbloqueado." };
}

export async function annulAttempt(attemptId: string, reason: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("annul_attempt", { p_attempt: attemptId, p_reason: reason.slice(0, 1000) });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/profesora/correcciones/${attemptId}`);
  return { ok: true, message: "Intento anulado." };
}

// ---------------------------------------------------------------------------
// IA opcional: sugerencias que la profesora revisa
// ---------------------------------------------------------------------------
export async function requestAiSuggestion(attemptId: string, taskId: string): Promise<ActionState> {
  const profile = await requireStaff();
  if (!uuid.safeParse(attemptId).success || !uuid.safeParse(taskId).success) return { ok: false, error: "Solicitud no válida." };
  if (!isAiConfigured()) return { ok: false, error: "La IA no está configurada en el servidor (ANTHROPIC_API_KEY)." };
  const supabase = await createClient();
  const { data: settings } = await supabase.from("app_settings").select("key, value").in("key", ["ai.enabled", "ai.max_input_chars", "ai.daily_limit_per_teacher"]);
  const setting = (k: string) => settings?.find((s) => s.key === k)?.value;
  if (setting("ai.enabled") !== true) return { ok: false, error: "La administración no ha activado la IA." };

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase.from("ai_suggestions").select("id", { count: "exact", head: true }).eq("created_by", profile.id).gte("created_at", since);
  if ((count ?? 0) >= Number(setting("ai.daily_limit_per_teacher") ?? 40)) return { ok: false, error: "Ha alcanzado el límite diario de sugerencias de IA." };

  const [{ data: task }, { data: response }] = await Promise.all([
    supabase.from("tasks").select("id, instructions, content, interaction_type, rubric_version_id").eq("id", taskId).single(),
    supabase.from("task_responses").select("payload").eq("attempt_id", attemptId).eq("task_id", taskId).eq("item_key", "text").maybeSingle(),
  ]);
  if (!task || task.interaction_type !== "writing") return { ok: false, error: "Las sugerencias solo están disponibles para textos escritos." };
  const studentText = (response?.payload as { text?: string; option_key?: string | null } | undefined)?.text ?? "";
  const optionKey = (response?.payload as { option_key?: string | null } | undefined)?.option_key ?? null;
  const c = task.content as WritingContent;
  const option = c.options?.find((o) => o.key === optionKey);

  let { data: ev } = await supabase.from("evaluations").select("id, rubric_version_id").eq("attempt_id", attemptId).eq("task_id", taskId).maybeSingle();
  if (!ev) {
    const { error } = await supabase.rpc("save_evaluation", { p_attempt: attemptId, p_task: taskId, p_scores: [], p_global_comment: "", p_strengths: "", p_priorities: "", p_next_steps: "" });
    if (error) return { ok: false, error: errorMessage(error) };
    ({ data: ev } = await supabase.from("evaluations").select("id, rubric_version_id").eq("attempt_id", attemptId).eq("task_id", taskId).maybeSingle());
  }
  if (!ev) return { ok: false, error: "No se pudo preparar la evaluación." };
  const { data: rubric } = await supabase.from("rubric_versions").select("criteria").eq("id", ev.rubric_version_id).single();

  const result = await suggestWritingFeedback({
    instructions: option?.instructions ?? task.instructions,
    bullets: option?.bullets ?? c.bullets ?? [],
    stimulus: (option?.stimulus ?? c.stimulus)?.body,
    studentText,
    wordRange: option ? `${option.word_min}–${option.word_max} palabras` : c.word_min ? `${c.word_min}–${c.word_max} palabras` : undefined,
    criteria: (rubric?.criteria ?? []) as { key: string; label: string; description: string; bands: { band: number; summary: string }[] }[],
    maxChars: Number(setting("ai.max_input_chars") ?? 6000),
  });
  if (!result.ok) return { ok: false, error: result.error };
  const { error } = await supabase.from("ai_suggestions").insert({
    evaluation_id: ev.id,
    provider: "anthropic",
    model: result.model,
    input_chars: result.inputChars,
    suggestion: result.suggestion,
    created_by: profile.id,
  });
  if (error) return { ok: false, error: "No se pudo guardar la sugerencia." };
  revalidatePath(`/profesora/correcciones/${attemptId}`);
  return { ok: true, message: "Sugerencia generada. Revísela antes de usarla." };
}

export async function setAiSuggestionStatus(attemptId: string, id: string, status: "accepted" | "rejected"): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("ai_suggestions").update({ status }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo actualizar la sugerencia." };
  revalidatePath(`/profesora/correcciones/${attemptId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Asignaciones, invitaciones y planes
// ---------------------------------------------------------------------------
const assignmentSchema = z
  .object({
    version_id: uuid,
    title: z.string().trim().min(3).max(160),
    target: z.string().regex(/^(class|student):[0-9a-f-]{36}$/),
    mode: z.enum(["practice", "formal"]),
    section_ids: z.array(uuid).default([]),
    opens_at: z.string().min(1),
    closes_at: z.string().optional().default(""),
    max_attempts: z.coerce.number().int().min(1).max(20),
    immediate_feedback: z.boolean(),
    resume_policy: z.enum(["allow", "teacher_unlock"]),
  })
  .refine((v) => v.mode === "practice" || !v.immediate_feedback, { message: "La corrección inmediata solo está disponible en práctica." });

export async function createAssignment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireStaff();
  const parsed = assignmentSchema.safeParse({
    version_id: formData.get("version_id"),
    title: formData.get("title"),
    target: formData.get("target"),
    mode: formData.get("mode"),
    section_ids: formData.getAll("section_ids"),
    opens_at: formData.get("opens_at"),
    closes_at: formData.get("closes_at") ?? "",
    max_attempts: formData.get("max_attempts"),
    immediate_feedback: formData.get("immediate_feedback") === "on",
    resume_policy: formData.get("resume_policy") ?? "allow",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const [kind, id] = v.target.split(":");
  const opens = new Date(v.opens_at);
  const closes = v.closes_at ? new Date(v.closes_at) : null;
  if (Number.isNaN(opens.getTime()) || (closes && (Number.isNaN(closes.getTime()) || closes <= opens))) {
    return { ok: false, error: "Revise las fechas de apertura y cierre." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("exam_assignments").insert({
    version_id: v.version_id,
    title: v.title,
    class_id: kind === "class" ? id : null,
    student_id: kind === "student" ? id : null,
    mode: v.mode,
    section_ids: v.section_ids,
    opens_at: opens.toISOString(),
    closes_at: closes?.toISOString() ?? null,
    max_attempts: v.max_attempts,
    immediate_feedback: v.immediate_feedback,
    resume_policy: v.resume_policy,
    created_by: profile.id,
  });
  if (error) return { ok: false, error: "No se pudo crear la asignación. Compruebe que la clase o el estudiante le están asignados." };
  revalidatePath("/profesora/asignaciones");
  return { ok: true, message: "Simulacro asignado." };
}

export async function archiveAssignment(id: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("exam_assignments").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo archivar." };
  revalidatePath("/profesora/asignaciones");
  return { ok: true };
}

const inviteSchema = z.object({
  role: z.enum(["student", "teacher"]),
  class_id: z.union([uuid, z.literal("")]).transform((v) => v || null),
  email: z.union([z.email(), z.literal("")]).transform((v) => v || null),
  max_uses: z.coerce.number().int().min(1).max(200),
  days: z.coerce.number().int().min(1).max(60),
  note: z.string().max(200).default(""),
});

/** Crea un código de invitación. El código se muestra una sola vez; en la base de datos solo queda su hash. */
export async function createInvitation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireStaff();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (profile.role !== "admin" && (v.role !== "student" || !v.class_id)) {
    return { ok: false, error: "Solo puede invitar a estudiantes de sus clases." };
  }
  const code = generateInvitationCode();
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").insert({
    code_hash: hashInvitationCode(code),
    code_hint: code.slice(-4),
    role: v.role,
    class_id: v.class_id,
    email: v.email,
    max_uses: v.max_uses,
    expires_at: new Date(Date.now() + v.days * 86_400_000).toISOString(),
    note: v.note,
    created_by: profile.id,
  });
  if (error) return { ok: false, error: "No se pudo crear la invitación." };
  revalidatePath("/profesora/invitaciones");
  revalidatePath("/admin/invitaciones");
  return { ok: true, message: "Invitación creada. Copie el código ahora: no se volverá a mostrar.", data: { code } };
}

export async function revokeInvitation(id: string): Promise<ActionState> {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "No se pudo revocar." };
  revalidatePath("/profesora/invitaciones");
  revalidatePath("/admin/invitaciones");
  return { ok: true };
}

const teacherPlanSchema = z.object({
  student_id: uuid,
  minutes: z.enum(["15", "30", "60"]).transform(Number),
  weeks: z.coerce.number().int().min(1).max(12),
  target_level: z.enum(["A1", "A2", "B1", "B2", "C1", ""]).transform((v) => v || null),
  target_date: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .transform((v) => v || null),
  note: z.string().max(2000).default(""),
});

export async function createPlanForStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await requireStaff();
  const parsed = teacherPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Revise los datos del plan." };
  const v = parsed.data;
  const supabase = await createClient();
  const { data: results } = await supabase.from("published_results").select("report").eq("student_id", v.student_id);
  const diagnosis = buildDiagnosis((results ?? []).map((r) => r.report as PublishedReport));
  const items = generatePlan(diagnosis, v.minutes as 15 | 30 | 60, v.weeks);
  await supabase.from("study_plans").update({ status: "archived" }).eq("student_id", v.student_id).eq("status", "active");
  const { data: plan, error } = await supabase
    .from("study_plans")
    .insert({
      student_id: v.student_id,
      created_by: profile.id,
      title: `Plan de mejora (${v.minutes} min/día)`,
      minutes_per_day: v.minutes,
      weeks: v.weeks,
      target_level: v.target_level,
      target_date: v.target_date,
      teacher_note: v.note,
      diagnosis: { priorities: diagnosis.priorities, weeklyGoal: diagnosis.weeklyGoal },
    })
    .select("id")
    .single();
  if (error || !plan) return { ok: false, error: "No se pudo crear el plan (¿el estudiante pertenece a su clase?)." };
  const { error: itemsError } = await supabase.from("study_plan_items").insert(items.map((i) => ({ ...i, plan_id: plan.id })));
  if (itemsError) return { ok: false, error: "No se pudieron crear las actividades." };
  revalidatePath(`/profesora/alumnos/${v.student_id}`);
  return { ok: true, message: "Plan de mejora creado y visible para el estudiante." };
}
