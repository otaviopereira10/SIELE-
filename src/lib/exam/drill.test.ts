import { describe, expect, it } from "vitest";
import { bestByModule, moduleStatus, prepareDrill, seededShuffle } from "./drill";

const exercises = Array.from({ length: 12 }, (_, i) => ({ prompt: `P${i}`, options: ["bien", "mal", "regular"], answer: 0, explanation: "" }));

describe("prepareDrill", () => {
  it("da siempre el mismo resultado con la misma semilla (el servidor y el navegador coinciden)", () => {
    expect(prepareDrill(exercises, 42)).toEqual(prepareDrill(exercises, 42));
    expect(seededShuffle([1, 2, 3, 4, 5], 7)).toEqual(seededShuffle([1, 2, 3, 4, 5], 7));
  });

  it("varía entre tandas y limita el número de preguntas", () => {
    const a = prepareDrill(exercises, 1);
    const b = prepareDrill(exercises, 2);
    expect(a).toHaveLength(6);
    expect(a.map((e) => e.prompt)).not.toEqual(b.map((e) => e.prompt));
  });

  it("mantiene la respuesta correcta aunque cambie el orden de las opciones", () => {
    for (let seed = 0; seed < 25; seed++) {
      for (const e of prepareDrill(exercises, seed)) expect(e.options[e.answer]).toBe("bien");
    }
    const positions = new Set(Array.from({ length: 25 }, (_, seed) => prepareDrill(exercises, seed)[0].answer));
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe("estado de un módulo", () => {
  it("se domina a partir del 80 %", () => {
    expect(moduleStatus(undefined)).toBe("new");
    expect(moduleStatus({ score: 3, max: 8 })).toBe("review");
    expect(moduleStatus({ score: 7, max: 8 })).toBe("mastered");
    expect(moduleStatus({ score: 4, max: 5 })).toBe("mastered");
  });

  it("se queda con el mejor resultado", () => {
    const best = bestByModule([
      { module_key: "a", score: 1, max_score: 4 },
      { module_key: "a", score: 7, max_score: 8 },
      { module_key: "a", score: 2, max_score: 4 },
    ]);
    expect(best.get("a")).toEqual({ score: 7, max: 8 });
  });
});
