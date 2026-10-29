import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb } from "./support/db";
import { seedWorld, type World } from "./support/fixtures";

let db: TestDb;
let w: World;
let attempt: string;

type Json = Record<string, unknown>;

/** Recorre el examen completo como estudiante y lo envía. */
async function completeAttempt(): Promise<string> {
  const id = await db.rpc<string>(w.student, "start_attempt", [w.assignmentId]);
  for (const section of [w.sections.reading, w.sections.listening, w.sections.writing, w.sections.speaking]) {
    await db.rpc(w.student, "start_section", [id, section]);
    if (section === w.sections.reading) {
      await db.rpc(w.student, "save_response", [id, w.tasks.readingChoice, `q:${w.questions.r1.id}`, { option_id: w.questions.r1.correct[0] }]);
    }
    if (section === w.sections.writing) {
      await db.rpc(w.student, "save_response", [
        id,
        w.tasks.writing,
        "text",
        { text: "Hola, Nuria: ayer fui al mercado y compré fruta. Era muy bonito y había mucha gente." },
      ]);
    }
    if (section === w.sections.speaking) {
      const path = `${w.student}/${id}/${w.tasks.speaking}/p1-q1-1730000000000.webm`;
      await db.putObject("recordings", path, w.student, 4096);
      await db.rpc(w.student, "register_recording", [id, w.tasks.speaking, "p1", "q1", path, "audio/webm", 4096, 30000, "b".repeat(64)]);
    }
    await db.rpc(w.student, "complete_section", [id, section]);
  }
  await db.rpc(w.student, "submit_attempt", [id, true]);
  return id;
}

beforeAll(async () => {
  db = await TestDb.create();
  w = await seedWorld(db);
  attempt = await completeAttempt();
});
afterAll(async () => db?.close());

const writingScores = (bands: [number, number, number, number]) => [
  { criterion: "cohesion", band: bands[0], comment: "Conectores básicos bien usados." },
  { criterion: "correccion", band: bands[1], comment: "Errores en los pasados." },
  { criterion: "alcance", band: bands[2], comment: "" },
  { criterion: "cumplimiento", band: bands[3], comment: "Falta la despedida." },
];

describe("evaluación con rúbrica", () => {
  it("una profesora de otra clase no puede evaluar", async () => {
    await expect(
      db.rpc(w.otherTeacher, "save_evaluation", [attempt, w.tasks.writing, JSON.stringify(writingScores([3, 3, 3, 3])), "", "", "", ""]),
    ).rejects.toThrow(/forbidden/);
    await expect(
      db.rpc(w.student, "save_evaluation", [attempt, w.tasks.writing, JSON.stringify(writingScores([5, 5, 5, 5])), "", "", "", ""]),
    ).rejects.toThrow(/forbidden/);
  });

  it("guarda un borrador parcial sin calcular la nota", async () => {
    const res = await db.rpc<Json>(w.teacher, "save_evaluation", [
      attempt,
      w.tasks.writing,
      JSON.stringify([{ criterion: "cohesion", band: 3, comment: "Bien organizado." }]),
      "Primer vistazo",
      "",
      "",
      "",
    ]);
    expect(res.is_complete).toBe(false);
    expect(res.points).toBeNull();
  });

  it("completa la rúbrica y aplica la tabla de puntos de la Tarea 1", async () => {
    const res = await db.rpc<Json>(w.teacher, "save_evaluation", [
      attempt,
      w.tasks.writing,
      JSON.stringify(writingScores([3, 3, 3, 4])),
      "Texto comprensible",
      "Responde a todos los puntos",
      "Pretérito indefinido e imperfecto",
      "Practicar narración en pasado",
    ]);
    expect(res.is_complete).toBe(true);
    // 24,75 × 3 + 40,38 (Guía 2016, Tarea 1)
    expect(Number(res.points)).toBeCloseTo(114.63, 2);
    expect(Number(res.max_points)).toBeCloseTo(125, 2);
    // porcentaje pedagógico ponderado: (0,6·22·3 + 0,8·34) / 100
    expect(Number(res.pedagogical_percent)).toBeCloseTo(66.8, 1);
  });

  it("conserva las bandas guardadas al volver a editar un solo criterio", async () => {
    await db.rpc(w.teacher, "save_evaluation", [
      attempt,
      w.tasks.writing,
      JSON.stringify([{ criterion: "alcance", band: 3, comment: "Vocabulario adecuado." }]),
      "Texto comprensible",
      "Responde a todos los puntos",
      "Pretérito indefinido e imperfecto",
      "Practicar narración en pasado",
    ]);
    const rows = await db.as<{ criterion_key: string; band: number }>(
      w.teacher,
      `select criterion_key, band from public.rubric_scores rs join public.evaluations e on e.id = rs.evaluation_id
       where e.attempt_id = $1 order by criterion_key`,
      [attempt],
    );
    expect(rows.map((r) => r.band)).toEqual([3, 3, 3, 4]);
  });

  it("rechaza bandas fuera de 0–5 y criterios inexistentes", async () => {
    await expect(
      db.rpc(w.teacher, "save_evaluation", [attempt, w.tasks.writing, JSON.stringify([{ criterion: "cohesion", band: 7 }]), "", "", "", ""]),
    ).rejects.toThrow(/invalid_band/);
    await expect(
      db.rpc(w.teacher, "save_evaluation", [attempt, w.tasks.writing, JSON.stringify([{ criterion: "inventado", band: 2 }]), "", "", "", ""]),
    ).rejects.toThrow(/unknown_criterion/);
  });

  it("las anotaciones docentes con evidencias se guardan bajo RLS", async () => {
    const [ev] = await db.as<{ id: string }>(w.teacher, `select id from public.evaluations where attempt_id = $1`, [attempt]);
    await db.as(
      w.teacher,
      `insert into public.teacher_feedback (evaluation_id, kind, category, quote, explanation, correction, improved_example, is_systematic, created_by)
       values ($1, 'error', 'gram.pasados', 'Era muy bonito', 'Valoración de un hecho puntual terminado', 'Fue muy bonito', 'Fue un día precioso.', true, $2)`,
      [ev.id, w.teacher],
    );
    await expect(
      db.as(
        w.otherTeacher,
        `insert into public.teacher_feedback (evaluation_id, kind, category, created_by) values ($1, 'error', 'gram.pasados', $2)`,
        [ev.id, w.otherTeacher],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await db.as(w.student, `select * from public.teacher_feedback`)).toHaveLength(0);
    expect(await db.as(w.student, `select * from public.evaluations`)).toHaveLength(0);
  });
});

describe("publicación", () => {
  it("no publica mientras falte evaluar alguna tarea productiva", async () => {
    const res = await db.rpc<Json>(w.teacher, "publish_attempt_results", [attempt]);
    expect(res.status).toBe("incomplete");
    expect((res.missing as Json[]).map((m) => m.task_id)).toEqual([w.tasks.speaking]);
    expect(await db.as(w.student, `select * from public.published_results`)).toHaveLength(0);
  });

  it("publica el informe completo y el estudiante lo ve sin datos privados", async () => {
    const speaking = await db.rpc<Json>(w.teacher, "save_evaluation", [
      attempt,
      w.tasks.speaking,
      JSON.stringify([
        { criterion: "uso_lengua", band: 4, comment: "Discurso fluido" },
        { criterion: "cumplimiento", band: 3, comment: "Desarrolla poco" },
      ]),
      "",
      "",
      "",
      "",
    ]);
    expect(Number(speaking.points)).toBeCloseTo(26.4 + 10.2, 2);
    const res = await db.rpc<Json>(w.teacher, "publish_attempt_results", [attempt]);
    expect(res.status).toBe("published");

    const [row] = await db.as<{ report: Json }>(w.student, `select report from public.published_results where attempt_id = $1`, [attempt]);
    const text = JSON.stringify(row.report);
    expect(text).not.toMatch(/TRANSCRIPCION SECRETA|GUION PRIVADO/);
    expect(text).toMatch(/Fue muy bonito/);
    const sections = row.report.sections as Json[];
    const reading = sections.find((s) => s.skill === "reading") as Json;
    const objective = reading.objective as Json;
    expect(objective.correct).toBe(1);
    // la tabla de 38 ítems no se aplica a una prueba de 6 ítems: no se inventa un nivel
    expect((objective.estimate as Json).applicable).toBe(false);
    const writing = sections.find((s) => s.skill === "writing") as Json;
    expect(((writing.productive as Json).estimate as Json).applicable).toBe(false);
    expect((row.report.categories as Json[])[0]).toMatchObject({ category: "gram.pasados", count: 1 });
  });

  it("otro estudiante no ve el informe publicado", async () => {
    expect(await db.as(w.otherStudent, `select * from public.published_results`)).toHaveLength(0);
  });

  it("el historial registra cada cambio de la evaluación", async () => {
    const rows = await db.as<{ action: string }>(
      w.teacher,
      `select h.action from public.evaluation_history h join public.evaluations e on e.id = h.evaluation_id
       where e.task_id = $1 order by h.id`,
      [w.tasks.writing],
    );
    expect(rows.map((r) => r.action)).toContain("published");
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });
});

describe("nueva entrega solicitada", () => {
  it("reabre solo la tarea escrita y vuelve a cerrarla al entregar", async () => {
    await db.rpc(w.teacher, "request_resubmission", [attempt, w.tasks.writing, "Revisa los tiempos del pasado."]);
    await expect(
      db.rpc(w.student, "save_response", [attempt, w.tasks.readingChoice, `q:${w.questions.r1.id}`, { option_id: w.questions.r1.options[0] }]),
    ).rejects.toThrow(/attempt_closed/);
    const res = await db.rpc<Json>(w.student, "save_response", [
      attempt,
      w.tasks.writing,
      "text",
      { text: "Hola, Nuria: ayer fui al mercado y compré fruta. Fue un día precioso." },
    ]);
    expect(res.revision).toBe(2);
    await db.rpc(w.student, "submit_resubmission", [attempt, w.tasks.writing]);
    const [a] = await db.sql<{ status: string }>(`select status from public.attempts where id = $1`, [attempt]);
    expect(a.status).toBe("submitted");
    await expect(
      db.rpc(w.student, "save_response", [attempt, w.tasks.writing, "text", { text: "otro cambio" }]),
    ).rejects.toThrow(/attempt_closed/);
  });

  it("solo se permite en tareas escritas", async () => {
    await expect(db.rpc(w.teacher, "request_resubmission", [attempt, w.tasks.speaking, "Graba otra vez"])).rejects.toThrow(
      /resubmission_only_for_writing/,
    );
  });
});

describe("cuentas desactivadas", () => {
  it("un usuario desactivado pierde el acceso inmediatamente", async () => {
    await db.rpc(w.admin, "admin_set_active", [w.teacher, false]);
    expect(await db.as(w.teacher, `select * from public.task_responses`)).toHaveLength(0);
    await expect(db.rpc(w.teacher, "save_evaluation", [attempt, w.tasks.writing, "[]", "", "", "", ""])).rejects.toThrow(/forbidden/);
    await db.rpc(w.admin, "admin_set_active", [w.student, false]);
    await expect(db.rpc(w.student, "start_attempt", [w.assignmentId])).rejects.toThrow(/only_students/);
    await db.rpc(w.admin, "admin_set_active", [w.teacher, true]);
    await db.rpc(w.admin, "admin_set_active", [w.student, true]);
  });
});
