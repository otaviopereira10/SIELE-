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

export const TARGET_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type TargetLevel = (typeof TARGET_LEVELS)[number];

/** Qué significa cada nivel, en palabras sencillas (resumen propio del Marco Común Europeo). */
export const LEVEL_GUIDE: Record<TargetLevel, { name: string; canDo: string }> = {
  A1: { name: "Inicial", canDo: "Presentarse, hacer preguntas muy sencillas y entender frases básicas de la vida diaria." },
  A2: { name: "Básico", canDo: "Hablar de su rutina, su familia y sus compras, y entender mensajes cortos." },
  B1: { name: "Intermedio", canDo: "Arreglárselas en un viaje, contar experiencias y dar opiniones sencillas." },
  B2: { name: "Intermedio alto", canDo: "Argumentar con soltura, entender textos largos y conversar sin gran esfuerzo." },
  C1: { name: "Avanzado", canDo: "Expresarse con precisión en contextos académicos y profesionales, y captar matices." },
};

/** Niveles que abarca un módulo a partir de su etiqueta («A2–B1», «A1–A2», «Todos»). */
export function moduleLevelRange(label: string): [number, number] {
  const found = label.match(/A1|A2|B1|B2|C1/g);
  if (!found) return [levelRank("A1"), levelRank("C1")];
  return [levelRank(found[0]), levelRank(found[found.length - 1])];
}

/**
 * Niveles que conviene trabajar: del punto de partida al objetivo. Sin punto de partida conocido,
 * el nivel anterior al objetivo y el propio objetivo. Sin objetivo no se limita nada.
 */
export function levelWindow(target: string | null | undefined, current?: string | null): [number, number] | null {
  const top = levelRank(target);
  if (top < 1) return null;
  const known = levelRank(current);
  const low = known >= 0 ? Math.max(1, Math.min(known, top - 1)) : Math.max(1, top - 1);
  return [low, top];
}

export function moduleFitsWindow(label: string, window: [number, number] | null): boolean {
  if (!window) return true;
  const [low, high] = moduleLevelRange(label);
  return low <= window[1] && high >= window[0];
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
