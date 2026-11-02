import type { GradingData } from "@/lib/data/teacher";
import type { SpeakingContent, OralOption, OralPart, OralSegment } from "@/lib/exam/content-schema";
import { normalizeTaskContent } from "@/lib/exam/normalize";
import { EMPTY_RECORDING_BYTES } from "@/components/audio/recording-player";

export type GradingTask = GradingData["tasks"][number];
export type GradingEvaluation = GradingData["evaluations"][number];
export type GradingRecording = GradingData["recordings"][number];
export type Rubric = GradingData["rubrics"][number];

export interface Feedback {
  id: string;
  kind: "error" | "strength" | "suggestion";
  category: string;
  criterion_key: string | null;
  quote: string;
  char_start: number | null;
  char_end: number | null;
  recording_id: string | null;
  audio_ms: number | null;
  explanation: string;
  correction: string;
  improved_example: string;
  is_systematic: boolean;
}

export interface EvaluationState {
  scores: Record<string, { band: number | null; comment: string }>;
  globalComment: string;
  strengths: string;
  priorities: string;
  nextSteps: string;
}

export interface EvaluationMeta {
  status: string | null;
  isComplete: boolean;
  points: number | null;
  max: number | null;
  percent: number | null;
  updatedAt: string | null;
  /** Hay alguna banda elegida aunque falten otras. */
  started: boolean;
}

export function metaFromEvaluation(ev: GradingEvaluation | null | undefined): EvaluationMeta {
  const scores = (ev?.rubric_scores ?? []) as { band: number | null }[];
  return {
    status: ev?.status ?? null,
    isComplete: Boolean(ev?.is_complete),
    points: ev?.points ?? null,
    max: ev?.max_points ?? null,
    percent: ev?.pedagogical_percent ?? null,
    updatedAt: ev?.updated_at ?? null,
    started: scores.some((s) => s.band != null),
  };
}

export function stateFromEvaluation(ev: GradingEvaluation | null | undefined): EvaluationState {
  const scores: EvaluationState["scores"] = {};
  for (const s of (ev?.rubric_scores ?? []) as { criterion_key: string; band: number | null; comment: string }[]) {
    scores[s.criterion_key] = { band: s.band, comment: s.comment };
  }
  return { scores, globalComment: ev?.global_comment ?? "", strengths: ev?.strengths ?? "", priorities: ev?.priorities ?? "", nextSteps: ev?.next_steps ?? "" };
}

export function recordingsOf(data: GradingData, taskId: string): GradingRecording[] {
  return data.recordings.filter((r) => r.task_id === taskId);
}

export function isEmptyRecording(r: GradingRecording): boolean {
  return r.size_bytes < EMPTY_RECORDING_BYTES;
}

export function writingTextOf(data: GradingData, taskId: string): string {
  const response = data.responses.find((r) => r.task_id === taskId && r.item_key === "text");
  return (response?.payload as { text?: string } | undefined)?.text ?? "";
}

/** ¿El estudiante dejó algo que se pueda evaluar en esta tarea? */
export function hasResponse(data: GradingData, task: GradingTask): boolean {
  if (task.skill === "writing") return writingTextOf(data, task.id).trim().length > 0;
  return recordingsOf(data, task.id).some((r) => r.status === "verified" && !isEmptyRecording(r));
}

export function hasEmptyAudio(data: GradingData, taskId: string): boolean {
  return recordingsOf(data, taskId).some((r) => r.status === "verified" && isEmptyRecording(r));
}

export interface SpeakingItem {
  part: OralPart;
  partIndex: number;
  option: OralOption | null;
  autoAssigned: boolean;
  segment: OralSegment;
  segmentIndex: number;
  segmentTotal: number;
  recording: GradingRecording | null;
}

/** Lo que se esperaba grabar en cada parte, emparejado con lo que se grabó. */
export function speakingItems(data: GradingData, task: GradingTask): { parts: SpeakingContent["parts"]; items: SpeakingItem[]; orphans: GradingRecording[] } {
  const content = normalizeTaskContent("speaking", task.content) as unknown as SpeakingContent;
  const recordings = recordingsOf(data, task.id);
  const items: SpeakingItem[] = [];
  content.parts.forEach((part, partIndex) => {
    const choice = data.responses.find((r) => r.task_id === task.id && r.item_key === `choice:${part.key}`)?.payload as { option_key?: string; auto_assigned?: boolean } | undefined;
    const option = part.choice?.options.find((o) => o.key === choice?.option_key) ?? null;
    const segments = option?.segments?.length ? option.segments : (part.segments ?? part.choice?.options[0]?.segments ?? []);
    segments.forEach((segment, segmentIndex) => {
      items.push({
        part,
        partIndex,
        option,
        autoAssigned: Boolean(choice?.auto_assigned),
        segment,
        segmentIndex,
        segmentTotal: segments.length,
        recording: recordings.find((r) => r.part_key === part.key && r.segment_key === segment.key) ?? null,
      });
    });
  });
  const used = new Set(items.map((i) => i.recording?.id));
  return { parts: content.parts, items, orphans: recordings.filter((r) => !used.has(r.id)) };
}

/** Puntuación provisional en vivo; el servidor recalcula y guarda los valores definitivos. */
export function previewScore(criteria: { key: string; weight: number }[], state: EvaluationState, table: Record<string, number[]>) {
  const done = criteria.filter((c) => state.scores[c.key]?.band != null).length;
  const complete = criteria.length > 0 && done === criteria.length;
  const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
  const percent = complete && totalWeight > 0 ? (criteria.reduce((s, c) => s + ((state.scores[c.key].band as number) / 5) * c.weight, 0) / totalWeight) * 100 : null;
  const points = complete ? criteria.reduce((s, c) => s + (table[c.key]?.[state.scores[c.key].band as number] ?? 0), 0) : null;
  const max = criteria.reduce((s, c) => s + (table[c.key]?.[5] ?? 0), 0);
  return { done, complete, percent, points, max };
}
