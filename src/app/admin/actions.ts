"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthor, requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/exam/errors";
import { INTERACTION_TYPES, SKILLS, validateTaskContent, type InteractionType } from "@/lib/exam/content-schema";

export type ActionState = { ok: boolean; error?: string; message?: string; data?: unknown } | null;
const uuid = z.uuid();

async function rpc(fn: string, args: Record<string, unknown>, paths: string[], message = "Hecho."): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: errorMessage(error) };
  for (const p of paths) revalidatePath(p);
  return { ok: true, message };
}

// ---------------------------------------------------------------------------
// Usuarios y roles
// ---------------------------------------------------------------------------
export async function setRole(userId: string, role: "student" | "teacher" | "admin"): Promise<ActionState> {
  await requireRole("admin");
  if (!uuid.safeParse(userId).success || !["student", "teacher", "admin"].includes(role)) return { ok: false, error: "Solicitud no válida." };
  return rpc("admin_set_role", { p_user: userId, p_role: role }, ["/admin/usuarios"], "Rol actualizado.");
}

export async function setActive(userId: string, active: boolean): Promise<ActionState> {
  await requireRole("admin");
  const res = await rpc("admin_set_active", { p_user: userId, p_active: active }, ["/admin/usuarios"], active ? "Cuenta reactivada." : "Acceso revocado.");
  if (res?.ok && !active) {
    // cierra también las sesiones abiertas (la base de datos ya deniega el acceso a una cuenta inactiva)
    try {
      await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: "876000h" });
    } catch {
      /* el bloqueo en la base de datos es suficiente */
    }
  } else if (res?.ok && active) {
    try {
      await createAdminClient().auth.admin.updateUserById(userId, { ban_duration: "none" });
    } catch {
      /* sin efecto si no estaba bloqueada */
    }
  }
  return res;
}

export async function setAuthor(userId: string, can: boolean): Promise<ActionState> {
  await requireRole("admin");
  return rpc("admin_set_author", { p_user: userId, p_can: can }, ["/admin/usuarios"], "Permiso actualizado.");
}

/** Eliminación definitiva de una cuenta y de todos sus datos (cascada) y de sus grabaciones. */
export async function deleteAccount(userId: string, confirmEmail: string): Promise<ActionState> {
  const me = await requireRole("admin");
  if (!uuid.safeParse(userId).success) return { ok: false, error: "Solicitud no válida." };
  if (userId === me.id) return { ok: false, error: "No puede eliminar su propia cuenta." };
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("email, role").eq("id", userId).single();
  if (!target || target.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) return { ok: false, error: "El correo de confirmación no coincide." };
  if (target.role === "admin") return { ok: false, error: "Retire primero el rol de administración." };
  const admin = createAdminClient();
  // registrar antes de borrar (el registro de auditoría no depende del perfil)
  await admin.from("audit_logs").insert({ actor_id: me.id, action: "account_deleted", entity: "profile", entity_id: userId, details: { role: target.role } });
  // grabaciones del usuario en Storage
  const { data: files } = await admin.storage.from("recordings").list(userId, { limit: 1000 });
  for (const folder of files ?? []) {
    const { data: inner } = await admin.storage.from("recordings").list(`${userId}/${folder.name}`, { limit: 1000 });
    for (const task of inner ?? []) {
      const { data: objs } = await admin.storage.from("recordings").list(`${userId}/${folder.name}/${task.name}`, { limit: 1000 });
      if (objs?.length) await admin.storage.from("recordings").remove(objs.map((o) => `${userId}/${folder.name}/${task.name}/${o.name}`));
    }
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: "No se pudo eliminar la cuenta." };
  revalidatePath("/admin/usuarios");
  return { ok: true, message: "Cuenta y datos eliminados." };
}

// ---------------------------------------------------------------------------
// Clases
// ---------------------------------------------------------------------------
export async function createClass(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireRole("admin");
  const parsed = z
    .object({ name: z.string().trim().min(2).max(120), description: z.string().max(500).default(""), target_level: z.enum(["", "A1", "A2", "B1", "B2", "C1"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Revise el nombre de la clase." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("classes")
    .insert({ name: parsed.data.name, description: parsed.data.description, target_level: parsed.data.target_level || null, created_by: me.id });
  if (error) return { ok: false, error: "No se pudo crear la clase." };
  revalidatePath("/admin/clases");
  return { ok: true, message: "Clase creada." };
}

export async function archiveClass(classId: string): Promise<ActionState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("classes").update({ archived_at: new Date().toISOString() }).eq("id", classId);
  if (error) return { ok: false, error: "No se pudo archivar." };
  revalidatePath("/admin/clases");
  return { ok: true };
}

export async function assignTeacher(classId: string, teacherId: string, grant: boolean): Promise<ActionState> {
  await requireRole("admin");
  return rpc("admin_assign_teacher", { p_class: classId, p_teacher: teacherId, p_grant: grant }, ["/admin/clases"], grant ? "Acceso concedido." : "Acceso revocado.");
}

export async function setClassMember(classId: string, studentId: string, member: boolean): Promise<ActionState> {
  await requireRole("admin");
  return rpc("admin_set_class_member", { p_class: classId, p_student: studentId, p_member: member }, ["/admin/clases"]);
}

// ---------------------------------------------------------------------------
// Banco de simulacros
// ---------------------------------------------------------------------------
export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAuthor();
  const parsed = z
    .object({
      code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{2,40}$/, "Código: mayúsculas, números, guion o guion bajo."),
      title: z.string().trim().min(3).max(160),
      description: z.string().max(1000).default(""),
      scaffold: z.enum(["global", "empty"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: tpl, error } = await supabase
    .from("exam_templates")
    .insert({ code: parsed.data.code, title: parsed.data.title, description: parsed.data.description, created_by: me.id })
    .select("id")
    .single();
  if (error || !tpl) return { ok: false, error: "No se pudo crear la plantilla (¿código repetido?)." };
  const { data: source } = await supabase.from("sources").select("id").eq("code", "SIELE_EXAMEN_WEB").maybeSingle();
  const { data: version } = await supabase
    .from("exam_versions")
    .insert({ template_id: tpl.id, version_no: 1, created_by: me.id, format_source_id: source?.id ?? null })
    .select("id")
    .single();
  if (version && parsed.data.scaffold === "global") {
    // estructura pública de referencia: tiempos verificados en siele.org (29/10/2026)
    await supabase.from("exam_sections").insert([
      { version_id: version.id, skill: "reading", position: 1, title: "Comprensión de lectura", time_limit_seconds: 3600, allow_back: false, pause_after_seconds: 0 },
      { version_id: version.id, skill: "listening", position: 2, title: "Comprensión auditiva", time_limit_seconds: 3300, allow_back: false, pause_after_seconds: 900 },
      { version_id: version.id, skill: "writing", position: 3, title: "Expresión e interacción escritas", time_limit_seconds: 3000, allow_back: true, pause_after_seconds: 0 },
      { version_id: version.id, skill: "speaking", position: 4, title: "Expresión e interacción orales", time_limit_seconds: 1500, allow_back: false, pause_after_seconds: 0 },
    ]);
  }
  revalidatePath("/admin/simulacros");
  if (version) redirect(`/admin/simulacros/${version.id}`);
  return { ok: true };
}

export async function duplicateVersion(versionId: string): Promise<ActionState> {
  await requireAuthor();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicate_exam_version", { p_version: versionId, p_template: null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/admin/simulacros");
  redirect(`/admin/simulacros/${data as string}`);
}

export async function archiveVersion(versionId: string): Promise<ActionState> {
  await requireAuthor();
  return rpc("archive_exam_version", { p_version: versionId }, ["/admin/simulacros"], "Versión archivada.");
}

export async function deleteDraftVersion(versionId: string): Promise<ActionState> {
  await requireAuthor();
  const supabase = await createClient();
  const { error } = await supabase.from("exam_versions").delete().eq("id", versionId).eq("status", "draft");
  if (error) return { ok: false, error: "No se pudo eliminar el borrador." };
  revalidatePath("/admin/simulacros");
  redirect("/admin/simulacros");
}

/** Publica tras validar el contenido (Zod) y la integridad (SQL). */
export async function publishVersion(versionId: string): Promise<ActionState> {
  await requireAuthor();
  const supabase = await createClient();
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, interaction_type, content, questions(position), exam_sections!inner(version_id, title)")
    .eq("exam_sections.version_id", versionId);
  const contentIssues: string[] = [];
  for (const t of tasks ?? []) {
    const res = validateTaskContent(
      t.interaction_type as InteractionType,
      t.content,
      ((t.questions ?? []) as { position: number }[]).map((q) => q.position),
    );
    if (!res.ok) contentIssues.push(`${(t.exam_sections as unknown as { title: string }).title} · ${t.title}: ${res.issues.map((i) => i.message).join(" ")}`);
  }
  if (contentIssues.length) return { ok: false, error: `Contenido no válido: ${contentIssues.join(" | ")}` };
  const { data, error } = await supabase.rpc("publish_exam_version", { p_version: versionId });
  if (error) return { ok: false, error: errorMessage(error) };
  const res = data as { status: string; issues: { severity: string; message: string }[] };
  if (res.status !== "published") {
    return { ok: false, error: res.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ") };
  }
  revalidatePath(`/admin/simulacros/${versionId}`);
  revalidatePath("/admin/simulacros");
  return { ok: true, message: "Versión publicada. Ya se puede asignar; su contenido queda bloqueado." };
}

const sectionSchema = z.object({
  id: uuid,
  title: z.string().trim().min(2).max(160),
  instructions: z.string().max(4000).default(""),
  minutes: z.coerce.number().min(1).max(240),
  allow_back: z.boolean(),
  pause_minutes: z.coerce.number().min(0).max(60),
});

export async function updateSection(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuthor();
  const parsed = sectionSchema.safeParse({ ...Object.fromEntries(formData), allow_back: formData.get("allow_back") === "on" });
  if (!parsed.success) return { ok: false, error: "Revise los datos de la prueba." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("exam_sections")
    .update({ title: v.title, instructions: v.instructions, time_limit_seconds: Math.round(v.minutes * 60), allow_back: v.allow_back, pause_after_seconds: Math.round(v.pause_minutes * 60) })
    .eq("id", v.id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/admin/simulacros", "layout");
  return { ok: true, message: "Prueba actualizada." };
}

export async function addSection(versionId: string, skill: string): Promise<ActionState> {
  await requireAuthor();
  if (!SKILLS.includes(skill as (typeof SKILLS)[number])) return { ok: false, error: "Destreza no válida." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("exam_sections").select("position").eq("version_id", versionId);
  const position = Math.max(0, ...(existing ?? []).map((s) => s.position)) + 1;
  const defaults: Record<string, [string, number, boolean]> = {
    reading: ["Comprensión de lectura", 3600, false],
    listening: ["Comprensión auditiva", 3300, false],
    writing: ["Expresión e interacción escritas", 3000, true],
    speaking: ["Expresión e interacción orales", 1500, false],
  };
  const [title, secs, back] = defaults[skill];
  const { error } = await supabase.from("exam_sections").insert({ version_id: versionId, skill, position, title, time_limit_seconds: secs, allow_back: back });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/admin/simulacros/${versionId}`);
  return { ok: true };
}

export async function deleteSection(versionId: string, sectionId: string): Promise<ActionState> {
  await requireAuthor();
  const supabase = await createClient();
  const { error } = await supabase.from("exam_sections").delete().eq("id", sectionId);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/admin/simulacros/${versionId}`);
  return { ok: true };
}

const STARTER_CONTENT: Record<InteractionType, Record<string, unknown>> = {
  single_choice: { media: {}, texts: [{ key: "t1", label: "Texto 1", body: "Escriba aquí el texto.", question_positions: [1] }] },
  matching: { media: {}, bank_title: "Opciones", unique_use: false, layout: "select", texts: [] },
  dropdown_gap: { media: {}, passage_title: "", passage: "Texto con un hueco [[1]]." },
  fragment_gap: { media: {}, bank_title: "Fragmentos", passages: [{ key: "p1", title: "", body: "Texto con un hueco. [[1]]" }] },
  multi_select: { media: {}, prompt: "Seleccione los enunciados correctos." },
  writing: { media: {}, bullets: ["primer punto;"], word_min: 100, word_max: 150, keyboard: true },
  speaking: { media: {}, parts: [{ key: "p1", instructions: "Instrucciones de la parte.", segments: [{ key: "r", wait_seconds: 10, record_seconds: 60 }] }] },
};

export async function addTask(versionId: string, sectionId: string, type: string): Promise<ActionState> {
  await requireAuthor();
  if (!INTERACTION_TYPES.includes(type as InteractionType)) return { ok: false, error: "Tipo no válido." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("tasks").select("position").eq("section_id", sectionId);
  const position = Math.max(0, ...(existing ?? []).map((t) => t.position)) + 1;
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      section_id: sectionId,
      position,
      code: `T${position}-${Date.now().toString(36).toUpperCase()}`,
      title: `Tarea ${position}`,
      interaction_type: type,
      instructions: "",
      content: STARTER_CONTENT[type as InteractionType],
      declared_items: 0,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: errorMessage(error) };
  redirect(`/admin/simulacros/${versionId}/tareas/${data.id}`);
}

const taskSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(160),
  code: z.string().trim().min(3).max(40),
  level_label: z.string().max(20).default(""),
  instructions: z.string().max(4000),
  declared_items: z.coerce.number().int().min(0).max(60),
  max_audio_plays: z.coerce.number().int().min(0).max(10),
  suggested_minutes: z.union([z.literal(""), z.coerce.number().min(0).max(240)]),
  difficulty: z.coerce.number().int().min(1).max(5),
  lexical_topic: z.string().max(200).default(""),
  grammar_topic: z.string().max(200).default(""),
  source_ref: z.string().max(300).default(""),
  content: z.string().max(200_000),
  transcript: z.string().max(50_000).default(""),
  teacher_notes: z.string().max(10_000).default(""),
  content_status: z.enum(["draft", "reviewed"]),
});

export async function updateTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAuthor();
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  let content: unknown;
  try {
    content = JSON.parse(v.content);
  } catch {
    return { ok: false, error: "El contenido no es JSON válido." };
  }
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("interaction_type, questions(position)").eq("id", v.id).single();
  if (!task) return { ok: false, error: "Tarea no encontrada." };
  const check = validateTaskContent(
    task.interaction_type as InteractionType,
    content,
    ((task.questions ?? []) as { position: number }[]).map((q) => q.position),
  );
  if (!check.ok) return { ok: false, error: check.issues.map((i) => `${i.path || "contenido"}: ${i.message}`).join(" · ") };
  const { error } = await supabase
    .from("tasks")
    .update({
      title: v.title,
      code: v.code,
      level_label: v.level_label,
      instructions: v.instructions,
      declared_items: v.declared_items,
      max_audio_plays: v.max_audio_plays,
      suggested_seconds: v.suggested_minutes === "" ? null : Math.round(Number(v.suggested_minutes) * 60),
      difficulty: v.difficulty,
      lexical_topic: v.lexical_topic,
      grammar_topic: v.grammar_topic,
      source_ref: v.source_ref,
      content: check.content,
      content_status: v.content_status,
      reviewed_at: v.content_status === "reviewed" ? new Date().toISOString() : null,
    })
    .eq("id", v.id);
  if (error) return { ok: false, error: errorMessage(error) };
  await supabase.from("task_private").upsert({ task_id: v.id, transcript: v.transcript, teacher_notes: v.teacher_notes });
  revalidatePath("/admin/simulacros", "layout");
  return { ok: true, message: "Tarea guardada." };
}

export async function deleteTask(versionId: string, taskId: string): Promise<ActionState> {
  await requireAuthor();
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/admin/simulacros/${versionId}`);
  redirect(`/admin/simulacros/${versionId}`);
}

const questionSchema = z.object({
  taskId: uuid,
  questions: z
    .array(
      z.object({
        prompt: z.string().max(2000),
        level: z.enum(["", "A1", "A2", "B1", "B2", "C1"]),
        focus: z.enum(["", "global", "specific", "detail", "inference", "intention", "grammar", "lexis", "connector"]),
        points: z.number().positive().max(20),
        max_selections: z.number().int().min(1).max(12),
        options: z.array(z.object({ label: z.string().max(12), body: z.string().min(1).max(2000) })).max(30),
        correct: z.array(z.number().int().min(0)).min(1, "Cada pregunta necesita al menos una respuesta correcta."),
        explanation: z.string().max(4000),
      }),
    )
    .max(60),
  bank: z.array(z.object({ label: z.string().max(12), body: z.string().min(1).max(2000) })).max(30),
});

/**
 * Reemplaza preguntas, opciones y claves de una tarea en borrador (operación completa).
 * Las versiones publicadas no se pueden modificar: lo impide la base de datos.
 */
export async function saveQuestions(input: z.input<typeof questionSchema>): Promise<ActionState> {
  await requireAuthor();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { taskId, questions, bank } = parsed.data;
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("interaction_type").eq("id", taskId).single();
  if (!task) return { ok: false, error: "Tarea no encontrada." };
  const usesBank = ["matching", "fragment_gap", "multi_select"].includes(task.interaction_type);

  for (const [i, q] of questions.entries()) {
    const pool = usesBank ? bank : q.options;
    if (q.correct.some((c) => c >= pool.length)) return { ok: false, error: `Pregunta ${i + 1}: la respuesta correcta no existe.` };
    if (!usesBank && q.options.length < 2) return { ok: false, error: `Pregunta ${i + 1}: necesita al menos dos opciones.` };
    const bodies = q.options.map((o) => o.body.trim().toLowerCase());
    if (new Set(bodies).size !== bodies.length) return { ok: false, error: `Pregunta ${i + 1}: hay alternativas duplicadas.` };
  }

  // borrar en orden (las claves y opciones caen en cascada con la pregunta)
  const { error: delQ } = await supabase.from("questions").delete().eq("task_id", taskId);
  if (delQ) return { ok: false, error: errorMessage(delQ) };
  await supabase.from("question_options").delete().eq("task_id", taskId);

  const bankIds: string[] = [];
  for (const [i, o] of bank.entries()) {
    const { data, error } = await supabase.from("question_options").insert({ task_id: taskId, question_id: null, position: i + 1, label: o.label, body: o.body }).select("id").single();
    if (error || !data) return { ok: false, error: errorMessage(error) };
    bankIds.push(data.id);
  }
  let declared = 0;
  for (const [i, q] of questions.entries()) {
    const { data: qr, error } = await supabase
      .from("questions")
      .insert({ task_id: taskId, position: i + 1, prompt: q.prompt, level: q.level || null, focus: q.focus, points: q.points, max_selections: q.max_selections })
      .select("id")
      .single();
    if (error || !qr) return { ok: false, error: errorMessage(error) };
    const own: string[] = [];
    for (const [j, o] of q.options.entries()) {
      const { data, error: oe } = await supabase.from("question_options").insert({ task_id: taskId, question_id: qr.id, position: j + 1, label: o.label, body: o.body }).select("id").single();
      if (oe || !data) return { ok: false, error: errorMessage(oe) };
      own.push(data.id);
    }
    const pool = usesBank ? bankIds : own;
    const { error: ke } = await supabase.from("question_keys").insert({ question_id: qr.id, correct_option_ids: q.correct.map((c) => pool[c]), explanation: q.explanation });
    if (ke) return { ok: false, error: errorMessage(ke) };
    declared += task.interaction_type === "multi_select" ? q.correct.length : 1;
  }
  await supabase.from("tasks").update({ declared_items: declared }).eq("id", taskId);
  revalidatePath("/admin/simulacros", "layout");
  return { ok: true, message: `Preguntas guardadas (${declared} ítems).` };
}

// ---------------------------------------------------------------------------
// Multimedia
// ---------------------------------------------------------------------------
const mediaSchema = z.object({
  path: z.string().regex(/^uploads\/[0-9a-f-]{36}\.(mp3|m4a|mp4|ogg|webm|wav|png|jpg|jpeg|webp)$/),
  kind: z.enum(["audio", "image"]),
  mime_type: z.string().regex(/^(audio|image)\/[a-z0-9.+-]+$/),
  size_bytes: z.number().int().positive().max(26_214_400),
  duration_seconds: z.number().positive().max(3600).nullable(),
  is_synthetic_voice: z.boolean(),
  alt_text: z.string().max(500),
  transcript: z.string().max(50_000),
  source: z.string().max(300),
  playable: z.boolean(),
});

export async function registerMedia(input: z.input<typeof mediaSchema>): Promise<ActionState> {
  const me = await requireAuthor();
  const parsed = mediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      path: v.path,
      kind: v.kind,
      mime_type: v.mime_type,
      size_bytes: v.size_bytes,
      duration_seconds: v.duration_seconds,
      is_synthetic_voice: v.is_synthetic_voice,
      alt_text: v.alt_text,
      transcript: v.transcript,
      source: v.source || "Material original",
      check_status: v.playable ? "ok" : "failed",
      checked_at: new Date().toISOString(),
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "No se pudo registrar el archivo." };
  revalidatePath("/admin/multimedia");
  return { ok: true, message: "Archivo registrado.", data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// Rúbricas, fuentes, ajustes y retención
// ---------------------------------------------------------------------------
const rubricCriterion = z.object({
  key: z.string().regex(/^[a-z_]{2,40}$/),
  label: z.string().min(1),
  weight: z.number().positive(),
  description: z.string(),
  focus: z.array(z.string()).optional(),
  bands: z.array(z.object({ band: z.number().int().min(0).max(5), summary: z.string().min(1) })).length(6),
});

export async function createRubricVersion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireRole("admin");
  const parsed = z
    .object({ code: z.string().regex(/^[A-Z0-9_-]{3,40}$/), title: z.string().min(3).max(160), skill: z.enum(["writing", "speaking"]), criteria: z.string(), points_table: z.string() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Revise los campos de la rúbrica." };
  let criteria: z.infer<typeof rubricCriterion>[];
  let points: Record<string, Record<string, number[]>>;
  try {
    criteria = z.array(rubricCriterion).min(1).parse(JSON.parse(parsed.data.criteria));
    points = z.record(z.string(), z.record(z.string(), z.array(z.number().min(0)).length(6))).parse(JSON.parse(parsed.data.points_table));
  } catch {
    return { ok: false, error: "Criterios o tabla de puntos no válidos (JSON). Cada criterio necesita las bandas 0–5 y cada tabla seis valores." };
  }
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(totalWeight - 100) > 0.01) return { ok: false, error: `Las ponderaciones deben sumar 100 (suman ${totalWeight}).` };
  for (const [pos, table] of Object.entries(points)) {
    for (const c of criteria) if (!table[c.key]) return { ok: false, error: `La tabla «${pos}» no tiene valores para «${c.key}».` };
  }
  const supabase = await createClient();
  const { data: last } = await supabase.from("rubric_versions").select("version_no").eq("code", parsed.data.code).order("version_no", { ascending: false }).limit(1);
  const { error } = await supabase.from("rubric_versions").insert({
    code: parsed.data.code,
    version_no: (last?.[0]?.version_no ?? 0) + 1,
    title: parsed.data.title,
    skill: parsed.data.skill,
    criteria,
    points_table: points,
    verification: "pending",
    status: "draft",
    created_by: me.id,
  });
  if (error) return { ok: false, error: "No se pudo crear la versión de la rúbrica." };
  revalidatePath("/admin/rubricas");
  return { ok: true, message: "Rúbrica creada como borrador." };
}

export async function publishRubric(id: string): Promise<ActionState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { error } = await supabase.from("rubric_versions").update({ status: "published" }).eq("id", id).eq("status", "draft");
  if (error) return { ok: false, error: "No se pudo publicar." };
  revalidatePath("/admin/rubricas");
  return { ok: true, message: "Rúbrica publicada: se usará en las nuevas evaluaciones." };
}

export async function updateRuleSource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole("admin");
  const parsed = z
    .object({
      rule_key: z.string().min(2).max(80),
      verification: z.enum(["verified", "verified_older_edition", "pending", "contradictory"]),
      verified_at: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
      notes: z.string().max(2000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rule_sources")
    .update({ verification: parsed.data.verification, verified_at: parsed.data.verified_at || null, notes: parsed.data.notes })
    .eq("rule_key", parsed.data.rule_key);
  if (error) return { ok: false, error: "No se pudo guardar." };
  revalidatePath("/admin/fuentes");
  return { ok: true, message: "Regla actualizada." };
}

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireRole("admin");
  const parsed = z
    .object({
      ai_enabled: z.boolean(),
      ai_max_input_chars: z.coerce.number().int().min(500).max(30000),
      ai_daily_limit: z.coerce.number().int().min(0).max(1000),
      oral_recordings: z.coerce.number().int().min(30).max(3650),
      attempt_events: z.coerce.number().int().min(30).max(3650),
      response_revisions: z.coerce.number().int().min(30).max(3650),
      audit_logs: z.coerce.number().int().min(30).max(3650),
    })
    .safeParse({ ...Object.fromEntries(formData), ai_enabled: formData.get("ai_enabled") === "on" });
  if (!parsed.success) return { ok: false, error: "Revise los valores (retención entre 30 y 3650 días)." };
  const v = parsed.data;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const r1 = await supabase.from("app_settings").upsert([
    { key: "ai.enabled", value: v.ai_enabled, updated_by: me.id, updated_at: now },
    { key: "ai.max_input_chars", value: v.ai_max_input_chars, updated_by: me.id, updated_at: now },
    { key: "ai.daily_limit_per_teacher", value: v.ai_daily_limit, updated_by: me.id, updated_at: now },
  ]);
  const r2 = await supabase.from("retention_policies").upsert(
    (["oral_recordings", "attempt_events", "response_revisions", "audit_logs"] as const).map((entity) => ({ entity, retain_days: v[entity], updated_by: me.id, updated_at: now })),
  );
  if (r1.error || r2.error) return { ok: false, error: "No se pudieron guardar los ajustes." };
  revalidatePath("/admin/datos");
  return { ok: true, message: "Ajustes guardados." };
}

export async function runRetention(): Promise<ActionState> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_retention");
  if (error) return { ok: false, error: errorMessage(error) };
  // grabaciones caducadas: primero el archivo, después la fila
  const { data: recs } = await supabase.rpc("recordings_past_retention");
  let purged = 0;
  const list = (recs ?? []) as { id: string; storage_path: string }[];
  if (list.length) {
    const admin = createAdminClient();
    const { error: rmError } = await admin.storage.from("recordings").remove(list.map((r) => r.storage_path));
    if (!rmError) {
      const { data: n } = await supabase.rpc("purge_recording_rows", { p_ids: list.map((r) => r.id) });
      purged = Number(n ?? 0);
    }
  }
  revalidatePath("/admin/datos");
  const d = data as { attempt_events: number; response_revisions: number; audit_logs: number };
  return { ok: true, message: `Retención aplicada: ${d.attempt_events} eventos, ${d.response_revisions} borradores, ${d.audit_logs} registros y ${purged} grabaciones eliminados.` };
}
