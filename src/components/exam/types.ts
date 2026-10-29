import type { Skill } from "@/lib/exam/content-schema";
import type { PracticeCheckResult, RecordingInfo, ResponsePayload, RunnerOption, RunnerQuestion, RunnerTask } from "@/lib/exam/types";

/** Acceso a los recursos multimedia de la tarea. Cada reproducción la autoriza (y la cuenta) el servidor. */
export interface MediaApi {
  playsUsed(mediaKey: string): number;
  maxPlays(mediaKey: string): number;
  /** Registra la reproducción y devuelve una URL firmada de corta duración. */
  requestAudio(mediaKey: string): Promise<{ url: string; synthetic: boolean }>;
  imageUrl(mediaKey: string): string | undefined;
}

export interface OralApi {
  recordings: Record<string, RecordingInfo>;
  /** Sube la grabación y solo resuelve cuando el servidor la ha verificado. */
  upload(partKey: string, segmentKey: string, blob: Blob, durationMs: number): Promise<void>;
  /** Elecciones ya hechas en otras tareas ("4:choice:p1" → "salud") */
  linkedChoices: Record<string, string>;
  allowRerecord: boolean;
  micReady: boolean;
}

export interface TaskRendererProps {
  task: RunnerTask;
  questions: RunnerQuestion[];
  bank: RunnerOption[];
  answers: Record<string, ResponsePayload>;
  onAnswer: (itemKey: string, payload: ResponsePayload, opts?: { debounceMs?: number }) => void;
  readOnly: boolean;
  feedback?: PracticeCheckResult | null;
  media: MediaApi;
  skill: Skill;
  mode: "practice" | "formal" | "demo" | "preview";
  oral?: OralApi;
  /** El reproductor pautado terminó (comprensión auditiva formal): avanzar automáticamente. */
  onTimedSequenceEnd?: () => void;
}

export function optionOf(payload: ResponsePayload | undefined): string | null {
  return payload && "option_id" in payload ? payload.option_id : null;
}

export function optionsOf(payload: ResponsePayload | undefined): string[] {
  return payload && "option_ids" in payload ? payload.option_ids : [];
}

export function feedbackFor(feedback: PracticeCheckResult | null | undefined, questionId: string) {
  return feedback?.items.find((i) => i.question_id === questionId) ?? null;
}
