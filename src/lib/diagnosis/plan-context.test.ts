import { describe, expect, it } from "vitest";
import { buildDiagnosis, type Diagnosis } from "./engine";
import { PLACEMENT_KEY } from "./placement";
import { planContext } from "./plan-context";

const row = (module_key: string, score: number, max_score: number) => ({ module_key, score, max_score, completed_at: "2026-11-01" });

describe("planContext", () => {
  it("sin simulacros, el punto de partida es la prueba de nivel", () => {
    expect(planContext(buildDiagnosis([]), [row(PLACEMENT_KEY, 3, 5)]).currentLevel).toBe("B1");
    expect(planContext(buildDiagnosis([]), []).currentLevel).toBeNull();
  });

  it("con simulacros, parte del nivel más bajo medido", () => {
    const base = buildDiagnosis([]);
    const diagnosis: Diagnosis = {
      ...base,
      skills: base.skills.map((s, i) => (i < 2 ? { ...s, latest: { pedagogicalLevel: i === 0 ? "C1" : "A2" } as NonNullable<typeof s.latest> } : s)),
    };
    expect(planContext(diagnosis, [row(PLACEMENT_KEY, 5, 5)]).currentLevel).toBe("A2");
  });

  it("solo da por dominado lo que llega al 80 %", () => {
    const { mastered } = planContext(buildDiagnosis([]), [row("pasados", 5, 6), row("por-para", 3, 6)]);
    expect(mastered?.has("pasados")).toBe(true);
    expect(mastered?.has("por-para")).toBe(false);
  });
});
