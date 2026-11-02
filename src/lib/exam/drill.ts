import type { DrillExercise } from "@/content/refuerzo";

/** Barajado reproducible: con la misma semilla, el servidor y el navegador pintan lo mismo. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Menos preguntas que ejercicios tiene cada módulo: así cada tanda es de verdad distinta. */
export const DRILL_SIZE = 6;

/** Una tanda de ejercicios: varía las preguntas y el orden de las opciones, para no aprender la posición de memoria. */
export function prepareDrill(exercises: readonly DrillExercise[], seed: number, size = DRILL_SIZE): DrillExercise[] {
  return seededShuffle(exercises, seed)
    .slice(0, size)
    .map((exercise, index) => {
      const order = seededShuffle(
        exercise.options.map((_, i) => i),
        seed + index + 1,
      );
      return { ...exercise, options: order.map((i) => exercise.options[i]), answer: order.indexOf(exercise.answer) };
    });
}

export type ModuleStatus = "new" | "review" | "mastered";

/** A partir del 80 % de aciertos se da por dominado. */
export function moduleStatus(best: { score: number; max: number } | undefined): ModuleStatus {
  if (!best) return "new";
  return best.score / best.max >= 0.8 ? "mastered" : "review";
}

/** Mejor resultado de cada módulo. */
export function bestByModule(practice: readonly { module_key: string; score: number; max_score: number }[]): Map<string, { score: number; max: number }> {
  const best = new Map<string, { score: number; max: number }>();
  for (const p of practice) {
    const current = best.get(p.module_key);
    if (!current || p.score / p.max_score > current.score / current.max) best.set(p.module_key, { score: p.score, max: p.max_score });
  }
  return best;
}
