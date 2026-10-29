import type { Skill } from "@/lib/exam/content-schema";

/** Forma del informe publicado (instantánea generada por public._build_report en la base de datos). */
export interface LevelEstimate {
  applicable: boolean;
  reason?: string;
  kind?: "raw_to_level" | "points_to_level";
  level?: string;
  min_points?: number;
  max_points?: number;
  verification?: string;
  source_title?: string;
  source_edition?: string;
  source_url?: string;
  notes?: string;
}

export interface ReportCriterion {
  key: string;
  label: string;
  weight: number;
  band: number | null;
  points: number | null;
  comment: string;
  band_descriptor?: string | null;
}

export interface ReportFeedback {
  kind: "strength" | "error" | "suggestion";
  category: string;
  criterion_key?: string | null;
  quote: string;
  char_start?: number | null;
  char_end?: number | null;
  audio_ms?: number | null;
  segment?: string | null;
  explanation: string;
  correction: string;
  improved_example: string;
  is_systematic: boolean;
  severity: number;
}

export interface ReportProductiveTask {
  task_id: string;
  position: number;
  title: string;
  code: string;
  response_text: string | null;
  option_key: string | null;
  word_count: number | null;
  recordings: { part_key: string; segment_key: string; duration_ms: number }[];
  evaluation: {
    points: number | null;
    max_points: number | null;
    pedagogical_percent: number | null;
    global_comment: string;
    strengths: string;
    priorities: string;
    next_steps: string;
    rubric: { code: string; version_no: number; title: string; verification: string };
    criteria: ReportCriterion[];
    feedback: ReportFeedback[];
  } | null;
}

export interface ReportSection {
  section_id: string;
  skill: Skill;
  title: string;
  position: number;
  objective: {
    correct: number;
    wrong: number;
    blank: number;
    raw_points: number;
    max_points: number;
    by_task: { task_id: string; position: number; title: string; correct: number; wrong: number; blank: number; points: number; max_points: number }[];
    by_level: { level: string; correct: number; total: number }[];
    estimate: LevelEstimate;
  } | null;
  productive: {
    tasks: ReportProductiveTask[];
    total_points: number | null;
    max_points: number | null;
    complete: boolean;
    estimate: LevelEstimate;
  } | null;
}

export interface ReportItem {
  skill: Skill;
  section_position: number;
  task_position: number;
  task_title: string;
  question_position: number;
  prompt: string;
  level: string | null;
  focus: string;
  selected: { label: string; body: string }[];
  correct: { label: string; body: string }[];
  is_correct: boolean;
  answered: boolean;
  explanation: string;
}

export interface PublishedReport {
  generated_at: string;
  scope: "objective_auto" | "full";
  disclaimer: string;
  attempt: {
    id: string;
    mode: "practice" | "formal";
    started_at: string;
    submitted_at: string | null;
    assignment_title: string;
    exam_title: string;
    version_no: number;
    format_label: string;
  };
  student: { id: string; full_name: string };
  sections: ReportSection[];
  items: ReportItem[];
  categories: { category: string; count: number; systematic: boolean }[];
}

export interface PublishedResultRow {
  attempt_id: string;
  published_at: string;
  scope: "objective_auto" | "full";
  report: PublishedReport;
}

/** Porcentaje de aciertos (estadística de entrenamiento, nunca una nota oficial). */
export function objectivePercent(o: { correct: number; wrong: number; blank: number }): number {
  const total = o.correct + o.wrong + o.blank;
  return total === 0 ? 0 : Math.round((o.correct / total) * 1000) / 10;
}
