import type { InteractionType, Skill } from "./content-schema";

/** Datos de una tarea tal como llegan al estudiante (sin claves ni transcripciones). */
export interface RunnerOption {
  id: string;
  label: string;
  body: string;
}

export interface RunnerQuestion {
  id: string;
  position: number;
  prompt: string;
  max_selections: number;
  options: RunnerOption[];
}

export interface RunnerTask {
  id: string;
  position: number;
  title: string;
  code?: string;
  interaction_type: InteractionType;
  instructions: string;
  level_label?: string;
  content: Record<string, unknown>;
  declared_items: number;
  max_audio_plays: number;
  suggested_seconds?: number | null;
}

export interface SavedResponse {
  item_key: string;
  payload: ResponsePayload;
  word_count?: number;
  revision?: number;
  updated_at?: string;
}

export type ResponsePayload =
  | { option_id: string | null }
  | { option_ids: string[] }
  | { text: string; option_key?: string | null }
  | { option_key: string; auto_assigned?: boolean };

export interface RecordingInfo {
  part_key: string;
  segment_key: string;
  status: "pending" | "verified" | "failed";
  duration_ms: number;
}

export interface TaskPayload {
  task: RunnerTask;
  questions: RunnerQuestion[];
  bank: RunnerOption[];
  responses: SavedResponse[];
  audio_plays: { media_key: string; plays: number }[];
  recordings: RecordingInfo[];
  choices: Record<string, string>;
  deadline_at: string | null;
  server_now: string;
}

export type SectionStatus = "locked" | "ready" | "active" | "completed" | "timed_out";

export interface AttemptSection {
  section_id: string;
  position: number;
  skill: Skill;
  title: string;
  instructions: string;
  time_limit_seconds: number;
  allow_back: boolean;
  pause_after_seconds: number;
  status: SectionStatus;
  available_at: string | null;
  started_at: string | null;
  deadline_at: string | null;
  completed_at: string | null;
  current_task_position: number;
  max_task_position: number;
  tasks: {
    task_id: string;
    position: number;
    title: string;
    interaction_type: InteractionType;
    declared_items: number;
    answered: number;
    recordings: number;
    checked: boolean;
  }[];
}

export interface AttemptState {
  server_now: string;
  attempt: {
    id: string;
    status: "in_progress" | "submitted" | "published" | "resubmission_requested" | "expired" | "annulled";
    mode: "practice" | "formal";
    started_at: string;
    submitted_at: string | null;
    assignment_id: string;
    title: string;
    immediate_feedback: boolean;
    grace_seconds: number;
    exam_title: string;
    format_label: string;
    version_no: number;
  };
  sections: AttemptSection[];
  resubmissions: { task_id: string; reason: string; created_at: string }[];
}

export interface PracticeCheckResult {
  task_id: string;
  items: {
    question_id: string;
    position: number;
    selected: string | string[] | null;
    correct_option_ids: string[];
    is_correct: boolean;
    explanation: string;
  }[];
}
