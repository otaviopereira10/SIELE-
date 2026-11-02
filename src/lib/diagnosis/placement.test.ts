import { describe, expect, it } from "vitest";
import { PLACEMENT_BLOCKS } from "@/content/placement";
import { PLACEMENT_KEY, latestPlacement, placementLevel } from "./placement";

describe("placementLevel", () => {
  it("se queda con el último bloque superado seguido", () => {
    expect(placementLevel([{ level: "A1", correct: 6 }, { level: "A2", correct: 5 }, { level: "B1", correct: 2 }])).toBe("A2");
  });

  it("un bloque suspendido corta el avance aunque el siguiente saliera bien", () => {
    expect(placementLevel([{ level: "A1", correct: 6 }, { level: "A2", correct: 3 }, { level: "B1", correct: 6 }])).toBe("A1");
  });

  it("sin superar el primer bloque queda por debajo de A1", () => {
    expect(placementLevel([{ level: "A1", correct: 2 }])).toBe("pre_A1");
    expect(placementLevel([])).toBe("pre_A1");
  });
});

describe("latestPlacement", () => {
  it("lee la prueba más reciente del historial", () => {
    const practice = [
      { module_key: "pasados", score: 4, completed_at: "2026-11-03" },
      { module_key: PLACEMENT_KEY, score: 3, completed_at: "2026-11-02" },
      { module_key: PLACEMENT_KEY, score: 1, completed_at: "2026-10-02" },
    ];
    expect(latestPlacement(practice)).toEqual({ level: "B1", date: "2026-11-02" });
    expect(latestPlacement([])).toBeNull();
  });
});

describe("contenido de la prueba de nivel", () => {
  it("tiene los cinco niveles en orden y seis preguntas válidas en cada uno", () => {
    expect(PLACEMENT_BLOCKS.map((b) => b.level)).toEqual(["A1", "A2", "B1", "B2", "C1"]);
    for (const block of PLACEMENT_BLOCKS) {
      expect(block.questions).toHaveLength(6);
      for (const q of block.questions) {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.options[q.answer]).toBeTruthy();
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.explanation).not.toBe("");
      }
    }
  });
});
