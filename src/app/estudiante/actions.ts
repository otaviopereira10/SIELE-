"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { hashInvitationCode } from "@/lib/auth/codes";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/exam/errors";
import { buildDiagnosis, generatePlan } from "@/lib/diagnosis/engine";
import { PLACEMENT_KEY } from "@/lib/diagnosis/placement";
import { planContext } from "@/lib/diagnosis/plan-context";
import { LEVELS, levelRank } from "@/lib/exam/skills";
import { fitPlanToDate, itemDate, weeksUntil } from "@/lib/plan/schedule";
import type { PublishedReport } from "@/lib/results/report";
import { MODULES } from "@/content/refuerzo";
import { todayISO } from "@/lib/utils";

type Result = { ok: boolean; error?: string; message?: string } | null;

export async function startAttempt(assignmentId: string): Promise<Result> {
  await requireRole("student");
  if (!z.uuid().safeParse(assignmentId).success) return { ok: false, error: "Simulacro no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_attempt", { p_assignment: assignmentId });
  if (error) return { ok: false, error: errorMessage(error) };
  redirect(`/estudiante/intentos/${data as string}`);
}

/** Una fecha real del calendario, o nada. */
const optionalDate = z.union([z.iso.date(), z.literal("")]).transform((v) => v || null);

const profileSchema = z.object({ full_name: z.string().trim().min(2).max(120) });

export async function updateProfile(_prev: Result, formData: FormData): Promise<Result> {
  const profile = await requireRole("student", "teacher", "admin");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Revise los datos del formulario." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", profile.id);
  if (error) return { ok: false, error: "No se pudo guardar el perfil." };
  revalidatePath("/estudiante", "layout");
  return { ok: true, message: "Perfil actualizado." };
}

const goalSchema = z.object({
  target_level: z.enum(["A1", "A2", "B1", "B2", "C1"]),
  target_date: optionalDate,
});

/** Guarda el nivel que necesita el estudiante; todo lo demás (plan, biblioteca, progreso) se orienta a él. */
export async function setGoal(_prev: Result, formData: FormData): Promise<Result> {
  const profile = await requireRole("student");
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Elija el nivel que necesita." };
  if (parsed.data.target_date && parsed.data.target_date <= todayISO(Date.now())) return { ok: false, error: "La fecha del examen tiene que ser posterior a hoy." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", profile.id);
  if (error) return { ok: false, error: "No se pudo guardar su objetivo." };
  revalidatePath("/estudiante", "layout");
  return { ok: true, message: "Objetivo guardado." };
}

/** Guarda el nivel alcanzado en la prueba de nivel (su posición en la escala: 0 = inferior a A1 … 5 = C1). */
export async function recordPlacement(level: string): Promise<Result> {
  const profile = await requireRole("student");
  const score = levelRank(level);
  if (score < 0) return { ok: false, error: "Resultado no válido." };
  const supabase = await createClient();
  const { error } = await supabase.from("practice_progress").insert({ student_id: profile.id, module_key: PLACEMENT_KEY, score, max_score: LEVELS.length - 1 });
  if (error) return { ok: false, error: "No se pudo guardar el resultado." };
  revalidatePath("/estudiante", "layout");
  return { ok: true };
}

export async function joinClass(_prev: Result, formData: FormData): Promise<Result> {
  await requireRole("student");
  const code = String(formData.get("code") ?? "");
  if (code.replace(/[\s-]/g, "").length < 8) return { ok: false, error: "Introduzca el código completo." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_class_with_code", { p_code_hash: hashInvitationCode(code) });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/estudiante", "layout");
  return { ok: true, message: "Se ha unido a la clase." };
}

const planSchema = z.object({
  minutes: z.enum(["15", "30", "60"]).transform(Number),
  weeks: z.coerce.number().int().min(1).max(12),
  target_level: z.enum(["A1", "A2", "B1", "B2", "C1", ""]).transform((v) => v || null),
  target_date: optionalDate,
});

/** El estudiante genera su propio plan a partir del diagnóstico (la profesora puede crear otros). */
export async function createOwnPlan(_prev: Result, formData: FormData): Promise<Result> {
  const profile = await requireRole("student");
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Revise las opciones del plan." };
  if (parsed.data.target_date && parsed.data.target_date <= todayISO(Date.now())) return { ok: false, error: "La fecha del examen tiene que ser posterior a hoy." };
  const supabase = await createClient();
  const [{ data: results }, { data: practice }, { data: annulled }] = await Promise.all([
    supabase.from("published_results").select("attempt_id, report").eq("student_id", profile.id),
    supabase.from("practice_progress").select("module_key, score, max_score, completed_at").eq("student_id", profile.id).order("completed_at", { ascending: false }).limit(1000),
    supabase.from("attempts").select("id").eq("student_id", profile.id).eq("status", "annulled"),
  ]);
  const annulledIds = new Set((annulled ?? []).map((a) => a.id));
  const reports = (results ?? []).filter((r) => !annulledIds.has(r.attempt_id)).map((r) => r.report as PublishedReport);
  const diagnosis = buildDiagnosis(reports, { targetLevel: parsed.data.target_level });
  const today = todayISO(Date.now());
  const weeks = weeksUntil(today, parsed.data.target_date, parsed.data.weeks);
  const generated = generatePlan(diagnosis, parsed.data.minutes as 15 | 30 | 60, weeks, { targetLevel: parsed.data.target_level, ...planContext(diagnosis, practice ?? []) });
  const items = parsed.data.target_date ? fitPlanToDate(generated, today, parsed.data.target_date) : generated;

  // el plan anterior solo se archiva cuando el nuevo ya está completo: un fallo nunca deja al estudiante sin plan
  const { data: plan, error } = await supabase
    .from("study_plans")
    .insert({
      student_id: profile.id,
      created_by: profile.id,
      title: parsed.data.target_level ? `Hacia el nivel ${parsed.data.target_level}` : `Plan personal de ${parsed.data.minutes} minutos al día`,
      minutes_per_day: parsed.data.minutes,
      weeks,
      starts_on: today,
      target_level: parsed.data.target_level,
      target_date: parsed.data.target_date,
      diagnosis: { priorities: diagnosis.priorities, weeklyGoal: diagnosis.weeklyGoal },
    })
    .select("id")
    .single();
  if (error || !plan) return { ok: false, error: "No se pudo crear el plan." };
  const { error: itemsError } = await supabase.from("study_plan_items").insert(items.map((i) => ({ ...i, plan_id: plan.id })));
  if (itemsError) {
    await supabase.from("study_plans").delete().eq("id", plan.id);
    return { ok: false, error: "No se pudieron crear las actividades del plan." };
  }
  await supabase.from("study_plans").update({ status: "archived" }).eq("student_id", profile.id).eq("status", "active").eq("created_by", profile.id).neq("id", plan.id);
  if (parsed.data.target_level) {
    await supabase.from("profiles").update({ target_level: parsed.data.target_level, target_date: parsed.data.target_date }).eq("id", profile.id);
  }
  revalidatePath("/estudiante", "layout");
  return { ok: true, message: "Plan creado." };
}

export async function togglePlanItem(itemId: string, done: boolean): Promise<Result> {
  await requireRole("student", "teacher", "admin");
  if (!z.uuid().safeParse(itemId).success) return { ok: false, error: "Actividad no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_plan_item", { p_item: itemId, p_done: done });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/estudiante", "layout");
  return { ok: true };
}

export async function recordPractice(moduleKey: string, score: number, maxScore: number): Promise<Result> {
  const profile = await requireRole("student");
  if (!MODULES.some((m) => m.key === moduleKey)) return { ok: false, error: "Módulo desconocido." };
  if (!Number.isInteger(score) || !Number.isInteger(maxScore) || score < 0 || maxScore < 1 || score > maxScore) {
    return { ok: false, error: "Resultado no válido." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("practice_progress").insert({ student_id: profile.id, module_key: moduleKey, score, max_score: maxScore });
  if (error) return { ok: false, error: "No se pudo guardar el resultado." };
  // hacer la actividad la completa en el plan: el estudiante no tiene que marcarla a mano
  const { data: plan } = await supabase
    .from("study_plans")
    .select("starts_on, study_plan_items(id, week_no, day_no, position, module_key, completed_at)")
    .eq("student_id", profile.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // solo lo que ya toca: repasar un tema hoy no da por hecha la actividad de la semana que viene
  const today = todayISO(Date.now());
  const item = (plan?.study_plan_items ?? [])
    .filter((i) => i.module_key === moduleKey && !i.completed_at && plan && itemDate(plan.starts_on, i.week_no, i.day_no) <= today)
    .sort((a, b) => a.week_no - b.week_no || a.day_no - b.day_no || a.position - b.position)[0];
  const marked = item ? !(await supabase.rpc("toggle_plan_item", { p_item: item.id, p_done: true })).error : false;
  revalidatePath("/estudiante", "layout");
  return { ok: true, message: marked ? "Resultado guardado y actividad marcada en su plan." : "Resultado guardado en su progreso." };
}
