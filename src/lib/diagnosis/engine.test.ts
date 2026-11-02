import { describe, expect, it } from "vitest";
import type { PublishedReport, ReportSection } from "@/lib/results/report";
import { getModule } from "@/content/refuerzo";
import { levelRank, levelWindow, moduleFitsWindow, moduleLevelRange } from "@/lib/exam/skills";
import { buildDiagnosis, generatePlan, levelFromBands, levelFromObjective } from "./engine";

function objectiveSection(skill: "reading" | "listening", byTask: [number, number, number][], estimate = { applicable: false }): ReportSection {
  const correct = byTask.reduce((s, t) => s + t[0], 0);
  const wrong = byTask.reduce((s, t) => s + t[1], 0);
  const blank = byTask.reduce((s, t) => s + t[2], 0);
  return {
    section_id: `${skill}-sec`,
    skill,
    title: skill,
    position: skill === "reading" ? 1 : 2,
    objective: {
      correct,
      wrong,
      blank,
      raw_points: correct,
      max_points: correct + wrong + blank,
      by_task: byTask.map(([c, w, b], i) => ({ task_id: `t${i}`, position: i + 1, title: `Tarea ${i + 1}`, correct: c, wrong: w, blank: b, points: c, max_points: c + w + b })),
      by_level: [
        { level: "A1", correct: 5, total: 5 },
        { level: "A2", correct: 4, total: 5 },
        { level: "B1", correct: 3, total: 8 },
      ],
      estimate,
    },
    productive: null,
  };
}

function writingSection(errorQuotes: string[], bands: [number, number, number, number]): ReportSection {
  const keys = ["cohesion", "correccion", "alcance", "cumplimiento"];
  return {
    section_id: "w",
    skill: "writing",
    title: "Escrita",
    position: 3,
    objective: null,
    productive: {
      complete: true,
      total_points: 100,
      max_points: 125,
      estimate: { applicable: false, reason: "max_points_differs" },
      tasks: [
        {
          task_id: "wt1",
          position: 1,
          title: "Tarea 1",
          code: "EIE-T1",
          response_text: "texto",
          option_key: null,
          word_count: 120,
          recordings: [],
          evaluation: {
            points: 100,
            max_points: 125,
            pedagogical_percent: 60,
            global_comment: "",
            strengths: "",
            priorities: "",
            next_steps: "",
            rubric: { code: "EIE", version_no: 1, title: "x", verification: "verified_older_edition" },
            criteria: keys.map((k, i) => ({ key: k, label: k, weight: i === 3 ? 34 : 22, band: bands[i], points: null, comment: "" })),
            feedback: errorQuotes.map((q) => ({
              kind: "error" as const,
              category: "gram.pasados",
              quote: q,
              explanation: "Hecho terminado",
              correction: q.replace("era", "fue"),
              improved_example: "",
              is_systematic: true,
              severity: 2,
            })),
          },
        },
      ],
    },
  };
}

function report(id: string, date: string, sections: ReportSection[]): PublishedReport {
  return {
    generated_at: date,
    scope: "full",
    disclaimer: "",
    attempt: { id, mode: "formal", started_at: date, submitted_at: date, assignment_title: "x", exam_title: "x", version_no: 1, format_label: "x" },
    student: { id: "s", full_name: "S" },
    sections,
    items: [],
    categories: [],
  };
}

describe("estimaciones pedagógicas", () => {
  it("nivel objetivo: el más alto con al menos el 60 % encadenado", () => {
    expect(levelFromObjective([{ level: "A1", correct: 5, total: 5 }, { level: "A2", correct: 4, total: 5 }, { level: "B1", correct: 3, total: 8 }])).toBe("A2");
    expect(levelFromObjective([{ level: "A1", correct: 1, total: 5 }])).toBe("pre_A1");
    expect(levelFromObjective([])).toBeNull();
  });
  it("nivel por bandas: mediana de uso de la lengua", () => {
    expect(levelFromBands([3, 3, 2])).toBe("B1");
    expect(levelFromBands([])).toBeNull();
  });
});

describe("buildDiagnosis", () => {
  const first = report("a1", "2026-09-01T10:00:00Z", [objectiveSection("reading", [[5, 0, 0], [2, 3, 0]]), writingSection(["Ayer era un día bonito"], [3, 2, 3, 3])]);
  const second = report("a2", "2026-10-01T10:00:00Z", [
    objectiveSection("reading", [[5, 0, 0], [4, 1, 0]]),
    writingSection(["El viaje era increíble", "La fiesta era genial"], [3, 2, 3, 3]),
  ]);

  it("detecta errores recurrentes con evidencias reales del texto", () => {
    const d = buildDiagnosis([second, first]);
    expect(d.recurringErrors[0]).toMatchObject({ category: "gram.pasados", count: 3, attempts: 2, systematic: true });
    expect(d.recurringErrors[0].examples[0].quote).toBe("Ayer era un día bonito");
  });

  it("prioriza de forma concreta (no «estudie más gramática») y propone un módulo", () => {
    const d = buildDiagnosis([first, second]);
    expect(d.priorities.length).toBeGreaterThan(0);
    expect(d.priorities.length).toBeLessThanOrEqual(3);
    expect(d.priorities[0].title).toBe("Pretérito indefinido e imperfecto");
    expect(d.priorities[0].modules).toEqual(["pasados"]);
    expect(d.priorities[0].indicator).toMatch(/próximo simulacro/);
  });

  it("compara con el intento anterior", () => {
    const d = buildDiagnosis([first, second]);
    const reading = d.skills.find((s) => s.skill === "reading")!;
    expect(reading.previous?.percent).toBe(70);
    expect(reading.latest?.percent).toBe(90);
    expect(reading.trend).toBe("up");
  });

  it("no suma un total global si faltan conversiones verificadas", () => {
    expect(buildDiagnosis([first]).globalRange).toBeNull();
  });

  it("es determinista", () => {
    expect(JSON.stringify(buildDiagnosis([first, second]))).toBe(JSON.stringify(buildDiagnosis([second, first])));
  });
});

describe("generatePlan", () => {
  const d = buildDiagnosis([report("a1", "2026-09-01T10:00:00Z", [writingSection(["Ayer era un día bonito"], [3, 2, 3, 3])])]);

  it.each([15, 30, 60] as const)("respeta los %i minutos diarios", (minutes) => {
    const plan = generatePlan(d, minutes, 2);
    for (let week = 1; week <= 2; week++) {
      for (let day = 1; day <= 6; day++) {
        const total = plan.filter((i) => i.week_no === week && i.day_no === day).reduce((s, i) => s + i.minutes, 0);
        expect(total).toBe(minutes);
      }
    }
  });

  it("alterna actividades e incluye simulacros cronometrados y la prioridad del diagnóstico", () => {
    const plan = generatePlan(d, 30, 2);
    const activities = new Set(plan.map((i) => i.activity));
    expect(activities.has("timed_mock")).toBe(true);
    expect(activities.size).toBeGreaterThanOrEqual(4);
    expect(plan.some((i) => i.module_key === "pasados")).toBe(true);
  });

  it("no repite una misma actividad de prioridad más de dos veces por semana", () => {
    for (const minutes of [15, 30, 60] as const) {
      const plan = generatePlan(d, minutes, 4);
      for (let week = 1; week <= 4; week++) {
        const counts = new Map<string, number>();
        for (const i of plan.filter((p) => p.week_no === week && p.description.startsWith("Prioridad"))) counts.set(i.module_key ?? "", (counts.get(i.module_key ?? "") ?? 0) + 1);
        expect(Math.max(0, ...counts.values())).toBeLessThanOrEqual(2);
      }
    }
  });

  it("sin diagnóstico propone los módulos del nivel que se necesita, no los de otros niveles", () => {
    const empty = buildDiagnosis([]);
    const beginner = generatePlan(empty, 30, 4, { targetLevel: "A2" });
    const advanced = generatePlan(empty, 30, 4, { targetLevel: "C1" });
    const window = (plan: typeof beginner) => plan.filter((i) => i.activity !== "timed_mock").map((i) => getModule(i.module_key ?? "")?.level ?? "");
    expect(window(beginner).every((level) => /A1|A2|Todos/.test(level))).toBe(true);
    expect(window(advanced).every((level) => /B2|C1|Todos/.test(level))).toBe(true);
    expect(new Set(beginner.map((i) => i.module_key)).size).toBeGreaterThan(5);
  });

  it("quien parte de abajo empieza por lo más fácil", () => {
    const empty = buildDiagnosis([]);
    const plan = generatePlan(empty, 30, 8, { targetLevel: "B2", currentLevel: "A1" });
    const first = plan.find((i) => i.activity === "grammar");
    expect(getModule(first?.module_key ?? "")?.level).toMatch(/^A1/);
  });

  it("deja para el final lo que ya domina", () => {
    const empty = buildDiagnosis([]);
    const plain = generatePlan(empty, 30, 1, { targetLevel: "B1" }).find((i) => i.activity === "grammar");
    const skipped = generatePlan(empty, 30, 1, { targetLevel: "B1", mastered: new Set([plain?.module_key ?? ""]) }).find((i) => i.activity === "grammar");
    expect(skipped?.module_key).not.toBe(plain?.module_key);
  });

  it("las prioridades por encima del nivel objetivo no entran en el plan", () => {
    const low = report("low", "2026-09-01T10:00:00Z", [objectiveSection("reading", [[5, 0, 0], [5, 0, 0], [1, 7, 0], [0, 8, 0], [0, 12, 0]])]);
    low.items = [{ skill: "reading", task_position: 4, level: "B2" }, { skill: "reading", task_position: 5, level: "C1" }, { skill: "reading", task_position: 3, level: "B1" }] as typeof low.items;
    const general = buildDiagnosis([low]);
    expect(general.priorities.some((p) => p.modules.includes("inferencia"))).toBe(true);
    const targeted = buildDiagnosis([low], { targetLevel: "B1" });
    expect(targeted.priorities.some((p) => p.modules.includes("inferencia"))).toBe(false);
    const plan = generatePlan(general, 30, 4, { targetLevel: "A2", currentLevel: "A1" });
    expect(plan.some((i) => i.module_key === "inferencia")).toBe(false);
  });

  it("un plan corto también llega a los temas del nivel objetivo", () => {
    const plan = generatePlan(buildDiagnosis([]), 30, 4, { targetLevel: "B1", currentLevel: "A2" });
    const grammar = plan.filter((i) => i.activity === "grammar").map((i) => moduleLevelRange(getModule(i.module_key ?? "")?.level ?? "")[1]);
    expect(Math.max(...grammar)).toBeGreaterThanOrEqual(levelRank("B1"));
    expect(plan.some((i) => i.module_key === "presente-regular")).toBe(false);
  });

  it("no pone una misma prioridad dos veces el mismo día", () => {
    const plan = generatePlan(d, 60, 2).filter((i) => i.description.startsWith("Prioridad"));
    const seen = new Set<string>();
    for (const i of plan) {
      const key = `${i.week_no}-${i.day_no}-${i.module_key}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it("la práctica cronometrada usa un módulo del nivel y dura lo que dice", () => {
    const empty = buildDiagnosis([]);
    for (const targetLevel of ["A1", "C1"]) {
      const plan = generatePlan(empty, 60, 4, { targetLevel });
      const timed = plan.filter((i) => i.activity === "timed_mock" && i.title !== "Simulacro de control");
      expect(timed.length).toBeGreaterThan(0);
      for (const i of timed) {
        expect(i.minutes).toBe(15);
        expect(moduleFitsWindow(getModule(i.module_key ?? "")?.level ?? "", levelWindow(targetLevel)), `${targetLevel} ${i.module_key}`).toBe(true);
      }
    }
  });

  it("sin nivel objetivo mantiene el orden general en lugar de empezar por lo más básico", () => {
    const first = generatePlan(buildDiagnosis([]), 30, 1).find((i) => i.activity === "grammar");
    expect(first?.module_key).toBe("pasados");
  });

  it("termina con un simulacro de control", () => {
    const plan = generatePlan(d, 30, 3);
    const last = plan.filter((i) => i.week_no === 3 && i.activity === "timed_mock");
    expect(last[0].title).toBe("Simulacro de control");
    expect(plan.filter((i) => i.week_no === 1 && i.activity === "timed_mock")[0].title).toContain("Práctica cronometrada");
  });
});
