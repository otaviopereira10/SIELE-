import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb } from "./support/db";
import { seedWorld, type World } from "./support/fixtures";

let db: TestDb;
let w: World;
let attempt: string;

const sha = "a".repeat(64);

beforeAll(async () => {
  db = await TestDb.create();
  w = await seedWorld(db);
});
afterAll(async () => db?.close());

type Json = Record<string, unknown>;

describe("inicio y reanudación", () => {
  it("solo los estudiantes con la asignación pueden iniciar", async () => {
    await expect(db.rpc(w.otherStudent, "start_attempt", [w.assignmentId])).rejects.toThrow(/assignment_not_found/);
    await expect(db.rpc(w.teacher, "start_attempt", [w.assignmentId])).rejects.toThrow(/only_students/);
  });

  it("crea el intento y lo reanuda en lugar de duplicarlo", async () => {
    attempt = await db.rpc<string>(w.student, "start_attempt", [w.assignmentId]);
    expect(attempt).toMatch(/[0-9a-f-]{36}/);
    const again = await db.rpc<string>(w.student, "start_attempt", [w.assignmentId]);
    expect(again).toBe(attempt);
    const state = await db.rpc<Json>(w.student, "get_attempt_state", [attempt]);
    const sections = state.sections as Json[];
    expect(sections.map((s) => s.status)).toEqual(["ready", "locked", "locked", "locked"]);
  });

  it("otro estudiante no puede leer ni manipular el intento", async () => {
    await expect(db.rpc(w.otherStudent, "get_attempt_state", [attempt])).rejects.toThrow(/attempt_not_found/);
    await expect(
      db.rpc(w.otherStudent, "save_response", [attempt, w.tasks.readingChoice, `q:${w.questions.r1.id}`, { option_id: w.questions.r1.options[0] }]),
    ).rejects.toThrow(/attempt_not_found/);
  });

  it("no se puede abrir el contenido antes de iniciar la prueba", async () => {
    await expect(db.rpc(w.student, "get_attempt_task", [attempt, w.tasks.readingChoice])).rejects.toThrow(/section_not_active/);
  });
});

describe("comprensión de lectura", () => {
  it("el contenido entregado al estudiante no incluye claves ni transcripciones", async () => {
    await db.rpc(w.student, "start_section", [attempt, w.sections.reading]);
    const payload = await db.rpc<Json>(w.student, "get_attempt_task", [attempt, w.tasks.readingChoice]);
    const text = JSON.stringify(payload);
    expect(text).not.toMatch(/correct_option_ids|Explicación privada|TRANSCRIPCION|GUION PRIVADO/);
    expect((payload.questions as Json[]).length).toBe(2);
  });

  it("guarda respuestas y sobreviven a una recarga", async () => {
    await db.rpc(w.student, "save_response", [attempt, w.tasks.readingChoice, `q:${w.questions.r1.id}`, { option_id: w.questions.r1.options[1] }]);
    await db.rpc(w.student, "save_response", [attempt, w.tasks.readingChoice, `q:${w.questions.r2.id}`, { option_id: w.questions.r2.options[2] }]);
    const payload = await db.rpc<Json>(w.student, "get_attempt_task", [attempt, w.tasks.readingChoice]);
    const responses = payload.responses as { item_key: string; payload: Json }[];
    expect(responses).toHaveLength(2);
    expect(responses.find((r) => r.item_key === `q:${w.questions.r1.id}`)?.payload.option_id).toBe(w.questions.r1.options[1]);
  });

  it("rechaza opciones que no pertenecen a la pregunta", async () => {
    await expect(
      db.rpc(w.student, "save_response", [attempt, w.tasks.readingChoice, `q:${w.questions.r1.id}`, { option_id: w.questions.r2.options[0] }]),
    ).rejects.toThrow(/option_not_in_question/);
  });

  it("el estudiante no puede escribir directamente en sus respuestas ni ver la corrección", async () => {
    await expect(
      db.as(w.student, `update public.task_responses set auto_points = 99`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(w.student, `insert into public.task_responses (attempt_id, task_id, item_key, payload) values ($1, $2, 'x', '{}')`, [
        attempt,
        w.tasks.readingChoice,
      ]),
    ).rejects.toThrow(/permission denied/);
    expect(await db.as(w.student, `select * from public.task_responses`)).toHaveLength(0);
  });

  it("navegación hacia atrás bloqueada cuando la prueba no la permite", async () => {
    await db.rpc(w.student, "set_task_position", [attempt, w.sections.reading, 2]);
    await expect(db.rpc(w.student, "set_task_position", [attempt, w.sections.reading, 1])).rejects.toThrow(
      /navigation_back_not_allowed/,
    );
    await expect(
      db.rpc(w.student, "save_response", [attempt, w.tasks.readingChoice, `q:${w.questions.r1.id}`, { option_id: w.questions.r1.options[0] }]),
    ).rejects.toThrow(/navigation_back_not_allowed/);
  });

  it("asociación con banco común y selección múltiple con límite", async () => {
    await db.rpc(w.student, "save_response", [attempt, w.tasks.readingMatching, `q:${w.questions.m1.id}`, { option_id: w.bank.match[2] }]);
    await db.rpc(w.student, "set_task_position", [attempt, w.sections.reading, 3]);
    await expect(
      db.rpc(w.student, "save_response", [attempt, w.tasks.readingMulti, `q:${w.questions.ms.id}`, { option_ids: w.bank.multi.slice(0, 3) }]),
    ).rejects.toThrow(/too_many_selections/);
    await db.rpc(w.student, "save_response", [
      attempt,
      w.tasks.readingMulti,
      `q:${w.questions.ms.id}`,
      { option_ids: [w.bank.multi[0], w.bank.multi[1]] },
    ]);
  });

  it("al completar la prueba se habilita la siguiente con la pausa configurada", async () => {
    const res = await db.rpc<Json>(w.student, "complete_section", [attempt, w.sections.reading]);
    expect(res.next_section_id).toBe(w.sections.listening);
    await expect(
      db.rpc(w.student, "save_response", [attempt, w.tasks.readingMulti, `q:${w.questions.ms.id}`, { option_ids: [] }]),
    ).rejects.toThrow(/section_not_active/);
  });
});

describe("comprensión auditiva: reproducciones y temporizador del servidor", () => {
  it("limita las reproducciones del audio a las configuradas", async () => {
    await db.rpc(w.student, "start_section", [attempt, w.sections.listening]);
    const first = await db.rpc<Json>(w.student, "register_audio_play", [attempt, w.tasks.listening, "main"]);
    expect(first.asset_id).toBe(w.audioAssetId);
    expect(first.remaining).toBe(1);
    await db.rpc(w.student, "register_audio_play", [attempt, w.tasks.listening, "main"]);
    await expect(db.rpc(w.student, "register_audio_play", [attempt, w.tasks.listening, "main"])).rejects.toThrow(
      /max_plays_reached/,
    );
    await expect(db.rpc(w.student, "register_audio_play", [attempt, w.tasks.listening, "otro"])).rejects.toThrow(
      /media_not_found/,
    );
  });

  it("al vencer el tiempo el servidor rechaza respuestas y cierra la prueba", async () => {
    await db.rpc(w.student, "save_response", [attempt, w.tasks.listening, `q:${w.questions.l1.id}`, { option_id: w.questions.l1.options[2] }]);
    // el navegador no controla el reloj: se simula el paso de 56 minutos en el servidor
    await db.shiftAttemptTime(attempt, 3300 + 60);
    await expect(
      db.rpc(w.student, "save_response", [attempt, w.tasks.listening, `q:${w.questions.l1.id}`, { option_id: w.questions.l1.options[0] }]),
    ).rejects.toThrow(/section_not_active|time_expired/);
    const state = await db.rpc<Json>(w.student, "get_attempt_state", [attempt]);
    const sections = state.sections as Json[];
    expect(sections[1].status).toBe("timed_out");
    expect(sections[2].status).toBe("ready");
  });

  it("la respuesta guardada antes del vencimiento se conserva", async () => {
    const [r] = await db.sql<{ payload: Json }>(`select payload from public.task_responses where attempt_id = $1 and task_id = $2`, [
      attempt,
      w.tasks.listening,
    ]);
    expect(r.payload.option_id).toBe(w.questions.l1.options[2]);
  });
});

describe("expresión escrita", () => {
  it("cuenta las palabras en el servidor y guarda borradores", async () => {
    await db.rpc(w.student, "start_section", [attempt, w.sections.writing]);
    const text = "Hola, Nuria: ¿qué tal? Te escribo desde Granada — la ciudad es preciosa.";
    const res = await db.rpc<Json>(w.student, "save_response", [attempt, w.tasks.writing, "text", { text, option_key: null }]);
    expect(res.word_count).toBe(12);
    const revisions = await db.sql(`select * from public.response_revisions`);
    expect(revisions.length).toBe(1);
  });

  it("rechaza claves de opción inexistentes", async () => {
    await expect(
      db.rpc(w.student, "save_response", [attempt, w.tasks.writing, "text", { text: "x", option_key: "inventada" }]),
    ).rejects.toThrow(/invalid_option_key/);
  });
});

describe("expresión oral: grabaciones verificadas", () => {
  it("no registra una grabación que no está en Storage", async () => {
    await db.rpc(w.student, "complete_section", [attempt, w.sections.writing]);
    await db.rpc(w.student, "start_section", [attempt, w.sections.speaking]);
    const path = `${w.student}/${attempt}/${w.tasks.speaking}/p1-q1.webm`;
    await expect(
      db.rpc(w.student, "register_recording", [attempt, w.tasks.speaking, "p1", "q1", path, "audio/webm", 2048, 25000, sha]),
    ).rejects.toThrow(/recording_not_in_storage/);
  });

  it("detecta un tamaño distinto al subido", async () => {
    const path = `${w.student}/${attempt}/${w.tasks.speaking}/p1-q1.webm`;
    await db.as(w.student, `insert into storage.objects (bucket_id, name, owner, metadata) values ('recordings', $1, $2, $3)`, [
      path,
      w.student,
      JSON.stringify({ size: 2048 }),
    ]);
    await expect(
      db.rpc(w.student, "register_recording", [attempt, w.tasks.speaking, "p1", "q1", path, "audio/webm", 999, 25000, sha]),
    ).rejects.toThrow(/recording_size_mismatch/);
  });

  it("rechaza rutas de otro intento o usuario", async () => {
    const bad = `${w.otherStudent}/${attempt}/${w.tasks.speaking}/p1-q1.webm`;
    await expect(
      db.rpc(w.student, "register_recording", [attempt, w.tasks.speaking, "p1", "q1", bad, "audio/webm", 2048, 25000, sha]),
    ).rejects.toThrow(/invalid_recording_path/);
  });

  it("registra la grabación verificada y no permite repetirla en modo formal", async () => {
    const path = `${w.student}/${attempt}/${w.tasks.speaking}/p1-q1.webm`;
    const res = await db.rpc<Json>(w.student, "register_recording", [
      attempt,
      w.tasks.speaking,
      "p1",
      "q1",
      path,
      "audio/webm",
      2048,
      25000,
      sha,
    ]);
    expect(res.status).toBe("verified");
    await expect(
      db.rpc(w.student, "register_recording", [attempt, w.tasks.speaking, "p1", "q1", path, "audio/webm", 2048, 25000, sha]),
    ).rejects.toThrow(/recording_already_submitted/);
  });
});

describe("envío y corrección automática", () => {
  it("avisa de respuestas en blanco antes de enviar", async () => {
    const res = await db.rpc<Json>(w.student, "submit_attempt", [attempt, false]);
    expect(res.status).toBe("needs_confirmation");
    // r1 respondida, r2 incorrecta, m1 correcta, m2 en blanco, multi 1/2: en blanco solo m2
    expect(res.blank_items).toBe(1);
  });

  it("envía, corrige de forma reproducible y bloquea cambios", async () => {
    const res = await db.rpc<Json>(w.student, "submit_attempt", [attempt, true]);
    expect(res.status).toBe("submitted");
    const [reading] = await db.sql<{ correct: number; wrong: number; blank: number; raw_points: string; max_points: string }>(
      `select correct, wrong, blank, raw_points, max_points from public.attempt_section_scores where attempt_id = $1 and skill = 'reading'`,
      [attempt],
    );
    // r1 correcta, r2 incorrecta, m1 correcta, m2 en blanco, multi: 1 acierto + 1 error
    expect(reading).toMatchObject({ correct: 3, wrong: 2, blank: 1 });
    expect(Number(reading.raw_points)).toBe(3);
    expect(Number(reading.max_points)).toBe(6);
    const [listening] = await db.sql<{ correct: number }>(
      `select correct from public.attempt_section_scores where attempt_id = $1 and skill = 'listening'`,
      [attempt],
    );
    expect(listening.correct).toBe(1);

    await expect(
      db.rpc(w.student, "save_response", [attempt, w.tasks.writing, "text", { text: "cambio tardío" }]),
    ).rejects.toThrow(/attempt_closed/);
  });

  it("el estudiante no ve sus puntuaciones antes de la publicación", async () => {
    expect(await db.as(w.student, `select * from public.attempt_section_scores`)).toHaveLength(0);
    expect(await db.as(w.student, `select * from public.published_results`)).toHaveLength(0);
  });

  it("la profesora de la clase sí ve el intento y sus respuestas", async () => {
    expect(await db.as(w.teacher, `select * from public.task_responses where attempt_id = $1`, [attempt])).not.toHaveLength(0);
    expect(await db.as(w.otherTeacher, `select * from public.task_responses where attempt_id = $1`, [attempt])).toHaveLength(0);
  });

  it("el número máximo de intentos se respeta", async () => {
    await expect(db.rpc(w.student, "start_attempt", [w.assignmentId])).rejects.toThrow(/max_attempts_reached/);
  });
});

describe("versiones y validación", () => {
  it("duplicar crea un borrador con las claves reasignadas a las nuevas opciones", async () => {
    const newVersion = await db.rpc<string>(w.admin, "duplicate_exam_version", [w.versionId, null]);
    const [v] = await db.sql<{ status: string; version_no: number }>(`select status, version_no from public.exam_versions where id = $1`, [
      newVersion,
    ]);
    expect(v).toEqual({ status: "draft", version_no: 2 });
    const broken = await db.sql(
      `select k.question_id from public.question_keys k join public.questions q on q.id = k.question_id
       join public.tasks t on t.id = q.task_id join public.exam_sections s on s.id = t.section_id
       where s.version_id = $1 and exists (select 1 from unnest(k.correct_option_ids) c
         where not exists (select 1 from public.question_options o where o.id = c and o.task_id = t.id))`,
      [newVersion],
    );
    expect(broken).toHaveLength(0);
    const issues = await db.rpc<unknown[]>(w.admin, "validate_exam_version", [newVersion]);
    expect(issues.filter((i) => (i as Json).severity === "error")).toHaveLength(0);
  });

  it("la validación detecta preguntas sin clave e ítems no declarados", async () => {
    const newVersion = await db.rpc<string>(w.admin, "duplicate_exam_version", [w.versionId, null]);
    await db.sql(
      `delete from public.question_keys where question_id in (
         select q.id from public.questions q join public.tasks t on t.id = q.task_id join public.exam_sections s on s.id = t.section_id
         where s.version_id = $1 and t.position = 1 and s.skill = 'reading' and q.position = 1)`,
      [newVersion],
    );
    await db.sql(
      `update public.tasks set declared_items = 7 where section_id in (select id from public.exam_sections where version_id = $1 and skill = 'listening')`,
      [newVersion],
    );
    const issues = (await db.rpc<Json[]>(w.admin, "validate_exam_version", [newVersion])).map((i) => i.code);
    expect(issues).toContain("question_without_key");
    expect(issues).toContain("item_count_mismatch");
    const res = await db.rpc<Json>(w.admin, "publish_exam_version", [newVersion]);
    expect(res.status).toBe("invalid");
  });

  it("los intentos conservan la versión original aunque exista una nueva", async () => {
    const [a] = await db.sql<{ version_id: string }>(`select version_id from public.attempts where id = $1`, [attempt]);
    expect(a.version_id).toBe(w.versionId);
  });
});
