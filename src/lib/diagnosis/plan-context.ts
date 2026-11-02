import { bestByModule, moduleStatus } from "@/lib/exam/drill";
import { levelRank } from "@/lib/exam/skills";
import type { Diagnosis, PlanOptions } from "./engine";
import { latestPlacement } from "./placement";

/**
 * Lo que un plan necesita saber del estudiante: su punto de partida (el nivel más bajo medido en un
 * simulacro o, si no lo hay, la prueba de nivel) y los temas que ya domina.
 */
export function planContext(
  diagnosis: Diagnosis,
  practice: readonly { module_key: string; score: number; max_score: number; completed_at: string }[],
): Pick<PlanOptions, "currentLevel" | "mastered"> {
  const measured = diagnosis.skills.map((s) => s.latest?.pedagogicalLevel).filter((l): l is string => Boolean(l));
  const currentLevel = measured.length ? [...measured].sort((a, b) => levelRank(a) - levelRank(b))[0] : (latestPlacement(practice)?.level ?? null);
  const mastered = new Set([...bestByModule(practice)].filter(([, best]) => moduleStatus(best) === "mastered").map(([key]) => key));
  return { currentLevel, mastered };
}
