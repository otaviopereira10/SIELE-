import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PublishedReport } from "@/lib/results/report";

export interface QueueRow {
  id: string;
  status: string;
  mode: string;
  started_at: string;
  submitted_at: string | null;
  published_at: string | null;
  student_id: string;
  student_name: string;
  assignment_title: string;
  class_ids: string[];
  skills: string[];
  drafts: number;
  evaluated: number;
}

/** Bandeja de corrección: intentos visibles para la profesora (RLS) con su estado de evaluación. */
export async function loadQueue() {
  const supabase = await createClient();
  await supabase.rpc("sweep_expired_attempts");
  const [{ data: attempts }, { data: evaluations }, { data: members }] = await Promise.all([
    supabase
      .from("attempts")
      .select(
        "id, status, mode, started_at, submitted_at, published_at, student_id, profiles!attempts_student_id_fkey(full_name), exam_assignments(title), attempt_sections(exam_sections(skill))",
      )
      .neq("status", "annulled")
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .limit(500),
    supabase.from("evaluations").select("attempt_id, status, is_complete"),
    supabase.from("class_members").select("class_id, student_id"),
  ]);
  const rows: QueueRow[] = (attempts ?? []).map((a) => {
    const evs = (evaluations ?? []).filter((e) => e.attempt_id === a.id);
    return {
      id: a.id,
      status: a.status,
      mode: a.mode,
      started_at: a.started_at,
      submitted_at: a.submitted_at,
      published_at: a.published_at,
      student_id: a.student_id,
      student_name: (a.profiles as unknown as { full_name: string } | null)?.full_name ?? "—",
      assignment_title: (a.exam_assignments as unknown as { title: string } | null)?.title ?? "—",
      class_ids: (members ?? []).filter((m) => m.student_id === a.student_id).map((m) => m.class_id),
      skills: ((a.attempt_sections ?? []) as unknown as { exam_sections: { skill: string } | null }[]).map((s) => s.exam_sections?.skill ?? "").filter(Boolean),
      drafts: evs.filter((e) => e.status === "draft").length,
      evaluated: evs.filter((e) => e.is_complete).length,
    };
  });
  return rows;
}

export async function loadTeacherOverview() {
  const supabase = await createClient();
  await supabase.rpc("sweep_expired_attempts");
  const [classes, students, assignments, attempts, evaluations, results] = await Promise.all([
    supabase.from("classes").select("id, name, target_level, archived_at").is("archived_at", null).order("name"),
    supabase.from("profiles").select("id, full_name, email, target_level, is_active").eq("role", "student"),
    supabase.from("exam_assignments").select("id, title, mode, class_id, student_id, closes_at, archived_at, created_at").is("archived_at", null),
    supabase.from("attempts").select("id, student_id, status, submitted_at"),
    supabase.from("evaluations").select("id, status, attempt_id"),
    supabase.from("published_results").select("attempt_id, student_id, published_at, report"),
  ]);
  return {
    classes: classes.data ?? [],
    students: students.data ?? [],
    assignments: assignments.data ?? [],
    attempts: attempts.data ?? [],
    evaluations: evaluations.data ?? [],
    results: (results.data ?? []) as { attempt_id: string; student_id: string; published_at: string; report: PublishedReport }[],
  };
}

export interface GradingTask {
  id: string;
  position: number;
  title: string;
  code: string;
  interaction_type: "writing" | "speaking";
  instructions: string;
  content: Record<string, unknown>;
  rubric_version_id: string | null;
  skill: "writing" | "speaking";
  section_title: string;
  section_started_at: string | null;
  section_completed_at: string | null;
  transcript: string;
  teacher_notes: string;
}

/** Todo lo necesario para corregir un intento (con la sesión de la profesora: RLS decide qué ve). */
export async function loadGrading(attemptId: string) {
  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("attempts")
    .select(
      "id, status, mode, started_at, submitted_at, published_at, locked_by_teacher, student_id, version_id, profiles!attempts_student_id_fkey(full_name, email, target_level), exam_assignments(title, mode, immediate_feedback)",
    )
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return null;

  const { data: sections } = await supabase
    .from("attempt_sections")
    .select("section_id, status, started_at, completed_at, deadline_at, exam_sections(id, skill, title, position, time_limit_seconds)")
    .eq("attempt_id", attemptId)
    .order("position");
  const sectionRows = (sections ?? []).map((s) => ({ ...s, section: s.exam_sections as unknown as { id: string; skill: string; title: string; position: number; time_limit_seconds: number } }));
  const productiveIds = sectionRows.filter((s) => s.section.skill === "writing" || s.section.skill === "speaking").map((s) => s.section_id);

  const [tasksRes, responses, recordings, evaluations, scores, events, resubmissions] = await Promise.all([
    productiveIds.length
      ? supabase
          .from("tasks")
          .select("id, position, title, code, interaction_type, instructions, content, rubric_version_id, section_id, task_private(transcript, teacher_notes)")
          .in("section_id", productiveIds)
          .order("position")
      : Promise.resolve({ data: [] as never[] }),
    supabase.from("task_responses").select("id, task_id, item_key, payload, word_count, revision, first_saved_at, updated_at").eq("attempt_id", attemptId),
    supabase
      .from("oral_recordings")
      .select("id, task_id, part_key, segment_key, duration_ms, size_bytes, mime_type, status, teacher_transcript, transcript_source, created_at")
      .eq("attempt_id", attemptId),
    supabase
      .from("evaluations")
      .select(
        "id, task_id, status, points, max_points, pedagogical_percent, is_complete, global_comment, strengths, priorities, next_steps, rubric_version_id, updated_at, published_at, evaluator_id, rubric_scores(criterion_key, band, points, comment), teacher_feedback(id, kind, category, criterion_key, quote, char_start, char_end, recording_id, audio_ms, explanation, correction, improved_example, is_systematic, severity, created_at)",
      )
      .eq("attempt_id", attemptId),
    supabase.from("attempt_section_scores").select("section_id, skill, correct, wrong, blank, raw_points, max_points, by_task").eq("attempt_id", attemptId),
    supabase.from("attempt_events").select("event_type, details, created_at").eq("attempt_id", attemptId).order("created_at"),
    supabase.from("resubmissions").select("id, task_id, reason, status, created_at, submitted_at").eq("attempt_id", attemptId).order("created_at"),
  ]);

  const tasks: GradingTask[] = ((tasksRes.data ?? []) as unknown as (Omit<GradingTask, "skill" | "section_title" | "section_started_at" | "section_completed_at" | "transcript" | "teacher_notes"> & {
    section_id: string;
    task_private: { transcript: string; teacher_notes: string } | null;
  })[]).map((t) => {
    const sec = sectionRows.find((s) => s.section_id === t.section_id)!;
    return {
      ...t,
      skill: sec.section.skill as "writing" | "speaking",
      section_title: sec.section.title,
      section_started_at: sec.started_at,
      section_completed_at: sec.completed_at,
      transcript: t.task_private?.transcript ?? "",
      teacher_notes: t.task_private?.teacher_notes ?? "",
    };
  });

  const writingResponseIds = (responses.data ?? []).filter((r) => r.item_key === "text").map((r) => r.id);
  const { data: revisions } = writingResponseIds.length
    ? await supabase.from("response_revisions").select("id, response_id, payload, word_count, kind, saved_at").in("response_id", writingResponseIds).order("saved_at")
    : { data: [] };

  const { data: rubrics } = await supabase.from("rubric_versions").select("id, code, version_no, skill, title, criteria, points_table, verification, status");
  const evalIds = (evaluations.data ?? []).map((e) => e.id);
  const { data: history } = evalIds.length
    ? await supabase.from("evaluation_history").select("evaluation_id, action, created_at, snapshot, changed_by").in("evaluation_id", evalIds).order("created_at", { ascending: false })
    : { data: [] };
  const { data: aiRows } = evalIds.length
    ? await supabase.from("ai_suggestions").select("id, evaluation_id, model, suggestion, status, created_at").in("evaluation_id", evalIds).order("created_at", { ascending: false })
    : { data: [] };

  return {
    attempt,
    student: attempt.profiles as unknown as { full_name: string; email: string; target_level: string | null },
    assignment: attempt.exam_assignments as unknown as { title: string; mode: string; immediate_feedback: boolean },
    sections: sectionRows,
    tasks,
    responses: responses.data ?? [],
    revisions: revisions ?? [],
    recordings: recordings.data ?? [],
    evaluations: evaluations.data ?? [],
    rubrics: rubrics ?? [],
    scores: scores.data ?? [],
    events: events.data ?? [],
    resubmissions: resubmissions.data ?? [],
    history: history ?? [],
    aiSuggestions: aiRows ?? [],
  };
}

export type GradingData = NonNullable<Awaited<ReturnType<typeof loadGrading>>>;
