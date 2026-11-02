import { LEVELS } from "@/lib/exam/skills";

/**
 * Prueba de nivel orientativa: bloques de dificultad creciente que se detienen en el primero que no se
 * supera, para no hacer pasar a nadie por preguntas muy lejos de su nivel. Se guarda como una práctica
 * más: la puntuación es la posición del nivel alcanzado (0 = inferior a A1 … 5 = C1).
 */
export const PLACEMENT_KEY = "prueba-nivel";
export const PLACEMENT_PASS = 4;

export function blockPassed(correct: number): boolean {
  return correct >= PLACEMENT_PASS;
}

/** Nivel alcanzado a partir de los aciertos de cada bloque, del más fácil al más difícil. */
export function placementLevel(blocks: readonly { level: string; correct: number }[]): string {
  let reached = "pre_A1";
  for (const block of blocks) {
    if (!blockPassed(block.correct)) break;
    reached = block.level;
  }
  return reached;
}

export interface PlacementResult {
  level: string;
  date: string;
}

/** Última prueba de nivel de un estudiante a partir de su historial de prácticas (más reciente primero). */
export function latestPlacement(practice: readonly { module_key: string; score: number; completed_at: string }[]): PlacementResult | null {
  const row = practice.find((p) => p.module_key === PLACEMENT_KEY);
  if (!row) return null;
  return { level: LEVELS[Math.max(0, Math.min(LEVELS.length - 1, row.score))], date: row.completed_at };
}
