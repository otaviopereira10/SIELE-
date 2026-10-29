import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PublishedReport } from "@/lib/results/report";

export interface AssignmentRow {
  id: string;
  title: string;
  mode: "practice" | "formal";
  opens_at: string;
  closes_at: string | null;
  max_attempts: number;
  immediate_feedback: boolean;
  section_ids: string[];
  version_id: string;
  class_name: string | null;
}

export interface AttemptRow {
  id: string;
  assignment_id: string;
  status: "in_progress" | "submitted" | "published" | "resubmission_requested" | "expired" | "annulled";
  mode: "practice" | "formal";
  started_at: string;
  submitted_at: string | null;
  published_at: string | null;
}

/** Datos del panel del estudiante. Todas las consultas pasan por RLS con su sesión. */
export async function loadStudentOverview(studentId: string) {
  const supabase = await createClient();
  const [assignments, attempts, results, plan, practice] = await Promise.all([
    supabase
      .from("exam_assignments")
      .select("id, title, mode, opens_at, closes_at, max_attempts, immediate_feedback, section_ids, version_id, classes(name)")
      .is("archived_at", null)
      .order("opens_at", { ascending: false }),
    supabase
      .from("attempts")
      .select("id, assignment_id, status, mode, started_at, submitted_at, published_at")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false }),
    supabase.from("published_results").select("attempt_id, published_at, scope, report").eq("student_id", studentId).order("published_at", { ascending: true }),
    supabase
      .from("study_plans")
      .select("id, title, minutes_per_day, starts_on, weeks, target_level, target_date, teacher_note, created_at, study_plan_items(id, week_no, day_no, position, activity, skill, title, description, module_key, minutes, completed_at)")
      .eq("student_id", studentId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("practice_progress").select("module_key, score, max_score, completed_at").eq("student_id", studentId).order("completed_at", { ascending: false }).limit(200),
  ]);

  const assignmentRows: AssignmentRow[] = (assignments.data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    mode: a.mode,
    opens_at: a.opens_at,
    closes_at: a.closes_at,
    max_attempts: a.max_attempts,
    immediate_feedback: a.immediate_feedback,
    section_ids: a.section_ids,
    version_id: a.version_id,
    class_name: (a.classes as unknown as { name: string } | null)?.name ?? null,
  }));

  return {
    assignments: assignmentRows,
    attempts: (attempts.data ?? []) as AttemptRow[],
    reports: (results.data ?? []).map((r) => r.report as PublishedReport),
    resultRows: (results.data ?? []) as { attempt_id: string; published_at: string; scope: string; report: PublishedReport }[],
    plan: plan.data,
    practice: practice.data ?? [],
  };
}

export const ATTEMPT_STATUS: Record<AttemptRow["status"], { label: string; tone: "brand" | "warn" | "ok" | "neutral" | "danger" | "blue" }> = {
  in_progress: { label: "En curso", tone: "brand" },
  submitted: { label: "Enviado · pendiente de corrección", tone: "warn" },
  resubmission_requested: { label: "Nueva entrega solicitada", tone: "danger" },
  published: { label: "Resultados publicados", tone: "ok" },
  expired: { label: "Caducado", tone: "neutral" },
  annulled: { label: "Anulado", tone: "neutral" },
};
