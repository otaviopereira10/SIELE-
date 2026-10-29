import type { TestDb } from "./db";

export interface World {
  admin: string;
  teacher: string;
  otherTeacher: string;
  student: string;
  otherStudent: string;
  classA: string;
  classB: string;
  versionId: string;
  sections: { reading: string; listening: string; writing: string; speaking: string };
  tasks: {
    readingChoice: string;
    readingMatching: string;
    readingMulti: string;
    listening: string;
    writing: string;
    speaking: string;
  };
  questions: Record<string, { id: string; options: string[]; correct: string[] }>;
  bank: Record<string, string[]>;
  assignmentId: string;
  audioAssetId: string;
}

async function one<T>(db: TestDb, sql: string, params: unknown[] = []): Promise<T> {
  const rows = await db.sql<T>(sql, params);
  return rows[0];
}

/** Construye un mundo pequeño pero completo: usuarios, clases y un simulacro publicado con las cuatro pruebas. */
export async function seedWorld(db: TestDb): Promise<World> {
  const admin = await db.createUser("admin@test.local", "admin", "Ana Admin");
  const teacher = await db.createUser("prof@test.local", "teacher", "Pilar Profesora");
  const otherTeacher = await db.createUser("otra@test.local", "teacher", "Olga Otra");
  const student = await db.createUser("alumno@test.local", "student", "Sergio Estudiante");
  const otherStudent = await db.createUser("otro@test.local", "student", "Teresa Otra");

  const { id: classA } = await one<{ id: string }>(db, `insert into public.classes (name) values ('Grupo A') returning id`);
  const { id: classB } = await one<{ id: string }>(db, `insert into public.classes (name) values ('Grupo B') returning id`);
  await db.sql(`insert into public.teacher_assignments (class_id, teacher_id) values ($1, $2), ($3, $4)`, [
    classA,
    teacher,
    classB,
    otherTeacher,
  ]);
  await db.sql(`insert into public.class_members (class_id, student_id) values ($1, $2), ($3, $4)`, [
    classA,
    student,
    classB,
    otherStudent,
  ]);

  const { id: templateId } = await one<{ id: string }>(
    db,
    `insert into public.exam_templates (code, title) values ('TEST-01', 'Simulacro de prueba') returning id`,
  );
  const { id: versionId } = await one<{ id: string }>(
    db,
    `insert into public.exam_versions (template_id, version_no) values ($1, 1) returning id`,
    [templateId],
  );

  const section = async (skill: string, position: number, seconds: number, allowBack: boolean, pause = 0) =>
    (
      await one<{ id: string }>(
        db,
        `insert into public.exam_sections (version_id, skill, position, title, time_limit_seconds, allow_back, pause_after_seconds)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [versionId, skill, position, `Prueba ${skill}`, seconds, allowBack, pause],
      )
    ).id;
  const sections = {
    reading: await section("reading", 1, 3600, false),
    listening: await section("listening", 2, 3300, false, 900),
    writing: await section("writing", 3, 3000, true),
    speaking: await section("speaking", 4, 900, false),
  };

  const { id: audioAssetId } = await one<{ id: string }>(
    db,
    `insert into public.media_assets (path, kind, mime_type, size_bytes, transcript, is_synthetic_voice)
     values ('audio/test.mp3', 'audio', 'audio/mpeg', 1000, 'TRANSCRIPCION SECRETA', true) returning id`,
  );

  const task = async (
    sectionId: string,
    position: number,
    type: string,
    declared: number,
    content: Record<string, unknown> = {},
  ) =>
    (
      await one<{ id: string }>(
        db,
        `insert into public.tasks (section_id, position, code, title, interaction_type, instructions, declared_items, content)
         values ($1, $2, $3, $4, $5, 'Instrucciones de la tarea.', $6, $7) returning id`,
        [sectionId, position, `T-${type}-${position}`, `Tarea ${position}`, type, declared, JSON.stringify(content)],
      )
    ).id;

  const tasks = {
    readingChoice: await task(sections.reading, 1, "single_choice", 2, { texts: [{ body: "Texto breve." }] }),
    readingMatching: await task(sections.reading, 2, "matching", 2),
    readingMulti: await task(sections.reading, 3, "multi_select", 2),
    listening: await task(sections.listening, 1, "single_choice", 1, {
      media: { main: { asset_id: audioAssetId, kind: "audio" } },
    }),
    writing: await task(sections.writing, 1, "writing", 0, { word_min: 100, word_max: 150 }),
    speaking: await task(sections.speaking, 1, "speaking", 0, {
      parts: [{ key: "p1", segments: [{ key: "q1", record_seconds: 30 }] }],
    }),
  };
  await db.sql(`insert into public.task_private (task_id, transcript) values ($1, 'GUION PRIVADO')`, [tasks.listening]);

  const questions: World["questions"] = {};
  const bank: World["bank"] = {};

  const question = async (taskId: string, position: number, name: string, options: string[], correctIdx: number[], maxSel = 1) => {
    const { id } = await one<{ id: string }>(
      db,
      `insert into public.questions (task_id, position, prompt, max_selections, level) values ($1, $2, $3, $4, 'A1') returning id`,
      [taskId, position, `Pregunta ${name}`, maxSel],
    );
    const optionIds: string[] = [];
    for (const [i, body] of options.entries()) {
      const row = await one<{ id: string }>(
        db,
        `insert into public.question_options (task_id, question_id, position, label, body) values ($1, $2, $3, $4, $5) returning id`,
        [taskId, id, i + 1, String.fromCharCode(97 + i), body],
      );
      optionIds.push(row.id);
    }
    questions[name] = { id, options: optionIds, correct: correctIdx.map((i) => optionIds[i]) };
    return id;
  };
  const bankOptions = async (taskId: string, name: string, bodies: string[]) => {
    const ids: string[] = [];
    for (const [i, body] of bodies.entries()) {
      const row = await one<{ id: string }>(
        db,
        `insert into public.question_options (task_id, question_id, position, label, body) values ($1, null, $2, $3, $4) returning id`,
        [taskId, i + 1, String.fromCharCode(65 + i), body],
      );
      ids.push(row.id);
    }
    bank[name] = ids;
    return ids;
  };
  const bankQuestion = async (taskId: string, position: number, name: string, correct: string[], maxSel = 1) => {
    const { id } = await one<{ id: string }>(
      db,
      `insert into public.questions (task_id, position, prompt, max_selections, points, level) values ($1, $2, $3, $4, $5, 'B1') returning id`,
      [taskId, position, `Pregunta ${name}`, maxSel, correct.length],
    );
    questions[name] = { id, options: [], correct };
    return id;
  };

  await question(tasks.readingChoice, 1, "r1", ["uno", "dos", "tres"], [1]);
  await question(tasks.readingChoice, 2, "r2", ["cuatro", "cinco", "seis"], [0]);
  const matchBank = await bankOptions(tasks.readingMatching, "match", ["Ana", "Luis", "Marta"]);
  await bankQuestion(tasks.readingMatching, 1, "m1", [matchBank[2]]);
  await bankQuestion(tasks.readingMatching, 2, "m2", [matchBank[0]]);
  const multiBank = await bankOptions(tasks.readingMulti, "multi", ["verdad 1", "falso 1", "verdad 2", "falso 2"]);
  await bankQuestion(tasks.readingMulti, 1, "ms", [multiBank[0], multiBank[2]], 2);
  await question(tasks.listening, 1, "l1", ["sí", "no", "quizá"], [2]);

  for (const q of Object.values(questions)) {
    await db.sql(`insert into public.question_keys (question_id, correct_option_ids, explanation) values ($1, $2, 'Explicación privada')`, [
      q.id,
      q.correct,
    ]);
  }

  const publish = await db.rpc<{ status: string; issues: unknown[] }>(admin, "publish_exam_version", [versionId]);
  if (publish.status !== "published") {
    throw new Error(`No se pudo publicar la versión de prueba: ${JSON.stringify(publish.issues)}`);
  }

  const [assignment] = await db.as<{ id: string }>(
    teacher,
    `insert into public.exam_assignments (version_id, title, class_id, mode, created_by)
     values ($1, 'Simulacro formal', $2, 'formal', $3) returning id`,
    [versionId, classA, teacher],
  );

  return {
    admin,
    teacher,
    otherTeacher,
    student,
    otherStudent,
    classA,
    classB,
    versionId,
    sections,
    tasks,
    questions,
    bank,
    assignmentId: assignment.id,
    audioAssetId,
  };
}
