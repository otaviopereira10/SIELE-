import { describe, expect, it } from "vitest";
import { DRILL_SIZE } from "@/lib/exam/drill";
import { TARGET_LEVELS, levelWindow, moduleFitsWindow, moduleLevelRange } from "@/lib/exam/skills";
import { MODULES, getModule } from "./refuerzo";

describe("biblioteca de refuerzo", () => {
  it("no repite claves y todas son válidas para guardar el progreso", () => {
    const keys = MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^[a-z0-9_.-]{2,60}$/);
  });

  it("cada módulo tiene ejercicios suficientes para que las tandas varíen", () => {
    for (const m of MODULES) expect(m.exercises.length, m.key).toBeGreaterThan(DRILL_SIZE);
  });

  it("todos los ejercicios tienen respuesta y explicación, sin opciones ni preguntas repetidas", () => {
    for (const m of MODULES) {
      const seen = new Set<string>();
      for (const e of m.exercises) {
        const label = `${m.key}: ${e.prompt}`;
        expect(e.options[e.answer], label).toBeTruthy();
        expect(new Set(e.options).size, label).toBe(e.options.length);
        expect(e.explanation.length, label).toBeGreaterThan(0);
        const id = `${e.prompt}|${[...e.options].sort().join("|")}`;
        expect(seen.has(id), label).toBe(false);
        seen.add(id);
      }
    }
  });

  it("los niveles de los módulos se pueden interpretar", () => {
    for (const m of MODULES) {
      const [low, high] = moduleLevelRange(m.level);
      expect(low, m.key).toBeGreaterThanOrEqual(1);
      expect(high, m.key).toBeGreaterThanOrEqual(low);
    }
  });

  it.each(TARGET_LEVELS)("hay material de todas las actividades para quien necesita %s", (target) => {
    const window = levelWindow(target);
    for (const activity of ["grammar", "vocabulary", "receptive", "writing", "speaking"] as const) {
      const fitting = MODULES.filter((m) => m.activity === activity && m.key !== "gestion-tiempo" && moduleFitsWindow(m.level, window));
      expect(fitting.length, `${target} ${activity}`).toBeGreaterThan(0);
    }
  });

  it("las actividades a las que apunta el diagnóstico existen", () => {
    for (const key of ["lectura-global", "inferencia", "cloze-gramatical", "escucha-estrategias", "escucha-conferencias", "cumplir-enunciado", "desarrollar-ideas", "conectores", "concordancia", "precision-lexica", "fluidez", "gestion-tiempo", "describir-imagen"]) {
      expect(getModule(key), key).toBeDefined();
    }
  });
});
