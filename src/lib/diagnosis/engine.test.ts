import { describe, expect, it } from "vitest";
import type { PublishedReport, ReportSection } from "@/lib/results/report";
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
});
