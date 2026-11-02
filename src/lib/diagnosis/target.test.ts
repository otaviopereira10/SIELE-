import { describe, expect, it } from "vitest";
import type { Skill } from "@/lib/exam/content-schema";
import type { SkillProgress, SkillSnapshot } from "./engine";
import { gapSummary, skillGaps, toReferenceTable } from "./target";

const table = toReferenceTable([
  { skill: "reading", kind: "raw_to_level", max_raw: 38, max_points: 250, bands: [{ level: "B2", min_raw: 27, min_points: 178 }, { level: "B1", min_raw: 18, min_points: 118 }] },
  { skill: "writing", kind: "points_to_level", max_raw: null, max_points: 250, bands: [{ level: "B2", min_points: 167 }] },
]);

function progress(skill: Skill, latest: Partial<SkillSnapshot> | null): SkillProgress {
  const snap = latest
    ? ({ skill, attemptId: "a", date: "2026-11-01", percent: 50, tableEstimate: null, pedagogicalLevel: null, pedagogicalLevelBasis: "", score: null, ...latest } as SkillSnapshot)
    : null;
  return { skill, latest: snap, previous: null, delta: null, trend: "na", history: [] };
}

describe("skillGaps", () => {
  it("calcula lo que falta en aciertos y en puntos", () => {
    const gaps = skillGaps(
      [
        progress("reading", { pedagogicalLevel: "B1", score: { value: 20, max: 38, unit: "aciertos" } }),
        progress("writing", { pedagogicalLevel: "B1", score: { value: 150.5, max: 250, unit: "puntos" } }),
      ],
      "B2",
      table,
    );
    expect(gaps.find((g) => g.skill === "reading")).toMatchObject({ status: "close", have: 20, missing: 7, need: { value: 27, max: 38, unit: "aciertos" } });
    expect(gaps.find((g) => g.skill === "writing")).toMatchObject({ status: "close", have: 150.5, missing: 17 });
  });

  it("no inventa lo que falta si la prueba no es comparable con la tabla", () => {
    const [reading] = skillGaps([progress("reading", { pedagogicalLevel: "A2", score: null })], "B2", table);
    expect(reading).toMatchObject({ status: "far", have: null, missing: null });
    expect(reading.need?.value).toBe(27);
    const [partial] = skillGaps([progress("reading", { pedagogicalLevel: "A2", score: { value: 3, max: 5, unit: "aciertos" } })], "B2", table);
    expect(partial.missing).toBeNull();
  });

  it("marca como alcanzado y no pide nada más", () => {
    const [reading] = skillGaps([progress("reading", { pedagogicalLevel: "C1", score: { value: 35, max: 38, unit: "aciertos" } })], "B2", table);
    expect(reading).toMatchObject({ status: "reached", missing: 0 });
  });

  it("sin objetivo o sin resultados no se puede comparar", () => {
    expect(skillGaps([progress("reading", { pedagogicalLevel: "B1" })], null, table)[0].status).toBe("unknown");
    expect(skillGaps([progress("reading", null)], "B2", table)[0].status).toBe("unknown");
  });
});

describe("gapSummary", () => {
  it("cuenta lo alcanzado y señala la destreza más alejada", () => {
    const gaps = skillGaps(
      [progress("reading", { pedagogicalLevel: "C1" }), progress("listening", { pedagogicalLevel: "B1" }), progress("writing", { pedagogicalLevel: "A2" }), progress("speaking", null)],
      "B2",
      table,
    );
    expect(gapSummary(gaps)).toEqual({ reached: 1, measured: 3, total: 4, weakest: "writing" });
  });

  it("no señala nada si todo está alcanzado", () => {
    expect(gapSummary(skillGaps([progress("reading", { pedagogicalLevel: "B2" })], "B2", table)).weakest).toBeNull();
  });
});
