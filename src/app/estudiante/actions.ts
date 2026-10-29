"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { hashInvitationCode } from "@/lib/auth/codes";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/exam/errors";
import { buildDiagnosis, generatePlan } from "@/lib/diagnosis/engine";
import type { PublishedReport } from "@/lib/results/report";
import { MODULES } from "@/content/refuerzo";

type Result = { ok: boolean; error?: string; message?: string } | null;

export async function startAttempt(assignmentId: string): Promise<Result> {
  await requireRole("student");
  if (!z.uuid().safeParse(assignmentId).success) return { ok: false, error: "Simulacro no válido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_attempt", { p_assignment: assignmentId });
  if (error) return { ok: false, error: errorMessage(error) };
  redirect(`/estudiante/intentos/${data as string}`);
}

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  target_level: z.enum(["A1", "A2", "B1", "B2", "C1", ""]).transform((v) => v || null),
  target_date: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .transform((v) => v || null),
});

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
  target_date: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .transform((v) => v || null),
});

/** El estudiante genera su propio plan a partir del diagnóstico (la profesora puede crear otros). */
export async function createOwnPlan(_prev: Result, formData: FormData): Promise<Result> {
  const profile = await requireRole("student");
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Revise las opciones del plan." };
  const supabase = await createClient();
  const { data: results } = await supabase.from("published_results").select("report").eq("student_id", profile.id);
  const diagnosis = buildDiagnosis((results ?? []).map((r) => r.report as PublishedReport));
  const items = generatePlan(diagnosis, parsed.data.minutes as 15 | 30 | 60, parsed.data.weeks);

  await supabase.from("study_plans").update({ status: "archived" }).eq("student_id", profile.id).eq("status", "active").eq("created_by", profile.id);
  const { data: plan, error } = await supabase
    .from("study_plans")
    .insert({
      student_id: profile.id,
      created_by: profile.id,
      title: `Plan personal de ${parsed.data.minutes} minutos al día`,
      minutes_per_day: parsed.data.minutes,
      weeks: parsed.data.weeks,
      target_level: parsed.data.target_level,
      target_date: parsed.data.target_date,
      diagnosis: { priorities: diagnosis.priorities, weeklyGoal: diagnosis.weeklyGoal },
    })
    .select("id")
    .single();
  if (error || !plan) return { ok: false, error: "No se pudo crear el plan." };
  const { error: itemsError } = await supabase.from("study_plan_items").insert(items.map((i) => ({ ...i, plan_id: plan.id })));
  if (itemsError) return { ok: false, error: "No se pudieron crear las actividades del plan." };
  revalidatePath("/estudiante/plan");
  return { ok: true, message: "Plan creado." };
}

export async function togglePlanItem(itemId: string, done: boolean): Promise<Result> {
  await requireRole("student", "teacher", "admin");
  if (!z.uuid().safeParse(itemId).success) return { ok: false, error: "Actividad no válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_plan_item", { p_item: itemId, p_done: done });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/estudiante/plan");
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
  revalidatePath("/estudiante/refuerzo");
  return { ok: true, message: "Resultado guardado." };
}
