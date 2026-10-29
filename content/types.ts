/** Formato de los simulacros de ejemplo que carga scripts/seed-content.ts. */
export type SeedSkill = "reading" | "listening" | "writing" | "speaking";
export type SeedLevel = "A1" | "A2" | "B1" | "B2" | "C1";
export type SeedFocus = "" | "global" | "specific" | "detail" | "inference" | "intention" | "grammar" | "lexis" | "connector";

export interface SeedOption {
  label?: string;
  body: string;
}

export interface SeedQuestion {
  prompt: string;
  level?: SeedLevel;
  focus?: SeedFocus;
  /** opciones propias (single_choice, dropdown_gap); vacío si usa el banco de la tarea */
  options?: SeedOption[];
  /** índice (o índices) de la opción correcta: en options o en el banco de la tarea */
  correct: number | number[];
  explanation: string;
  max_selections?: number;
  points?: number;
}

/** Referencia a un archivo local que el script sube a Storage y sustituye por su asset_id. */
export interface SeedMediaRef {
  file: string;
  kind: "audio" | "image";
  label?: string;
  max_plays?: number;
  alt?: string;
}

export interface SeedTask {
  code: string;
  title: string;
  type: "single_choice" | "matching" | "dropdown_gap" | "fragment_gap" | "multi_select" | "writing" | "speaking";
  level_label: string;
  instructions: string;
  content: Record<string, unknown> & { media?: Record<string, SeedMediaRef> };
  bank?: SeedOption[];
  questions?: SeedQuestion[];
  declared_items: number;
  max_audio_plays?: number;
  suggested_seconds?: number;
  skill_focus?: string[];
  lexical_topic?: string;
  grammar_topic?: string;
  difficulty?: number;
  teacher_notes?: string;
  /** fichero de audio cuyo guion se guarda como transcripción privada de la tarea */
  transcript_from?: string[];
}

export interface SeedSection {
  skill: SeedSkill;
  title: string;
  instructions: string;
  time_limit_seconds: number;
  allow_back: boolean;
  pause_after_seconds: number;
  tasks: SeedTask[];
}

export interface SeedExam {
  code: string;
  title: string;
  description: string;
  format_label: string;
  notes: string;
  sections: SeedSection[];
}
