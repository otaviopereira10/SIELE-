import type { Skill } from "./content-schema";

export const SKILL_META: Record<
  Skill,
  { label: string; short: string; tone: "comprehension" | "writing" | "speaking"; icon: string; description: string }
> = {
  reading: {
    label: "Comprensión de lectura",
    short: "Lectura",
    tone: "comprehension",
    icon: "book-open",
    description: "Textos escritos de complejidad creciente con preguntas de respuesta cerrada.",
  },
  listening: {
    label: "Comprensión auditiva",
    short: "Auditiva",
    tone: "comprehension",
    icon: "headphones",
    description: "Conversaciones, anuncios, entrevistas y conferencias que se escuchan dos veces.",
  },
  writing: {
    label: "Expresión e interacción escritas",
    short: "Escrita",
    tone: "writing",
    icon: "pen-line",
    description: "Un mensaje de respuesta y un texto argumentativo evaluados con rúbrica.",
  },
  speaking: {
    label: "Expresión e interacción orales",
    short: "Oral",
    tone: "speaking",
    icon: "mic",
    description: "Cinco tareas grabadas: preguntas, foto, situaciones, tema y argumentación.",
  },
};

export const SKILL_ORDER: Skill[] = ["reading", "listening", "writing", "speaking"];

export const LEVEL_LABEL: Record<string, string> = {
  pre_A1: "Inferior a A1",
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
};

export const LEVELS = ["pre_A1", "A1", "A2", "B1", "B2", "C1"] as const;
export type Level = (typeof LEVELS)[number];

export function levelRank(level: string | null | undefined): number {
  return level ? LEVELS.indexOf(level as Level) : -1;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
