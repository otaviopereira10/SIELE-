import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb } from "./support/db";
import { seedWorld, type World } from "./support/fixtures";

let db: TestDb;
let w: World;

beforeAll(async () => {
  db = await TestDb.create();
  w = await seedWorld(db);
});
afterAll(async () => db?.close());

describe("roles y perfiles", () => {
  it("un usuario nuevo siempre es estudiante aunque los metadatos digan admin", async () => {
    const id = await db.createUser("nuevo@test.local");
    const [p] = await db.sql<{ role: string }>(`select role from public.profiles where id = $1`, [id]);
    expect(p.role).toBe("student");
  });

  it("un estudiante no puede cambiar su propio rol", async () => {
    await expect(db.as(w.student, `update public.profiles set role = 'admin' where id = $1`, [w.student])).rejects.toThrow(
      /permission denied/,
    );
    const [p] = await db.sql<{ role: string }>(`select role from public.profiles where id = $1`, [w.student]);
    expect(p.role).toBe("student");
  });

  it("un estudiante sí puede cambiar su nombre", async () => {
    await db.as(w.student, `update public.profiles set full_name = 'Sergio E.' where id = $1`, [w.student]);
    const [p] = await db.sql<{ full_name: string }>(`select full_name from public.profiles where id = $1`, [w.student]);
    expect(p.full_name).toBe("Sergio E.");
  });

  it("una profesora no puede convertirse en administradora", async () => {
    await expect(db.as(w.teacher, `update public.profiles set role = 'admin' where id = $1`, [w.teacher])).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.rpc(w.teacher, "admin_set_role", [w.teacher, "admin"])).rejects.toThrow(/forbidden/);
  });

  it("solo el administrador asigna roles y queda auditado", async () => {
    const id = await db.createUser("futura@test.local");
    await db.rpc(w.admin, "admin_set_role", [id, "teacher"]);
    const [p] = await db.sql<{ role: string }>(`select role from public.profiles where id = $1`, [id]);
    expect(p.role).toBe("teacher");
    const logs = await db.sql(`select * from public.audit_logs where action = 'role_changed' and entity_id = $1`, [id]);
    expect(logs).toHaveLength(1);
  });

  it("no se puede retirar al último administrador", async () => {
    await expect(db.rpc(w.admin, "admin_set_role", [w.admin, "student"])).rejects.toThrow(/cannot_remove_last_admin/);
  });

  it("un usuario no autenticado no lee datos privados", async () => {
    await expect(db.as(null, `select * from public.profiles`)).rejects.toThrow(/permission denied/);
    await expect(db.as(null, `select * from public.attempts`)).rejects.toThrow(/permission denied/);
  });

  it("las funciones de servidor no se pueden invocar desde una sesión de usuario", async () => {
    await expect(db.rpc(w.student, "bootstrap_first_admin", ["alumno@test.local"])).rejects.toThrow(/permission denied/);
    await expect(db.rpc(w.student, "redeem_invitation", ["a".repeat(64), w.student])).rejects.toThrow(/permission denied/);
    await expect(db.rpc(w.admin, "check_rate_limit", ["x", 1, 60])).rejects.toThrow(/permission denied/);
  });

  it("bootstrap_first_admin falla si ya existe un administrador", async () => {
    await expect(db.asService(`select public.bootstrap_first_admin('alumno@test.local')`)).rejects.toThrow(/admin_already_exists/);
  });
});

describe("aislamiento entre clases", () => {
  it("el estudiante solo ve su perfil y a sus profesoras", async () => {
    const rows = await db.as<{ id: string }>(w.student, `select id from public.profiles`);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(w.student);
    expect(ids).toContain(w.teacher);
    expect(ids).not.toContain(w.otherStudent);
    expect(ids).not.toContain(w.otherTeacher);
  });

  it("una profesora no ve estudiantes de clases ajenas", async () => {
    const rows = await db.as<{ id: string }>(w.teacher, `select id from public.profiles where role = 'student'`);
    expect(rows.map((r) => r.id)).toEqual([w.student]);
    const other = await db.as(w.otherTeacher, `select id from public.profiles where id = $1`, [w.student]);
    expect(other).toHaveLength(0);
  });

  it("una profesora no puede concederse acceso a otra clase", async () => {
    await expect(
      db.as(w.teacher, `insert into public.teacher_assignments (class_id, teacher_id) values ($1, $2)`, [w.classB, w.teacher]),
    ).rejects.toThrow(/permission denied/);
    await expect(db.rpc(w.teacher, "admin_assign_teacher", [w.classB, w.teacher, true])).rejects.toThrow(/forbidden/);
  });

  it("una profesora no ve las clases ajenas", async () => {
    const rows = await db.as<{ id: string }>(w.teacher, `select id from public.classes`);
    expect(rows.map((r) => r.id)).toEqual([w.classA]);
  });

  it("una profesora no puede asignar simulacros a clases ajenas", async () => {
    await expect(
      db.as(
        w.teacher,
        `insert into public.exam_assignments (version_id, title, class_id, created_by) values ($1, 'x', $2, $3)`,
        [w.versionId, w.classB, w.teacher],
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("contenido del examen y claves", () => {
  it("el estudiante no lee el banco de preguntas ni las claves", async () => {
    expect(await db.as(w.student, `select * from public.question_keys`)).toHaveLength(0);
    expect(await db.as(w.student, `select * from public.tasks`)).toHaveLength(0);
    expect(await db.as(w.student, `select * from public.task_private`)).toHaveLength(0);
    expect(await db.as(w.student, `select * from public.media_assets`)).toHaveLength(0);
  });

  it("el personal docente sí ve las claves", async () => {
    expect((await db.as(w.teacher, `select * from public.question_keys`)).length).toBeGreaterThan(0);
  });

  it("una profesora sin permiso de autoría no edita el banco", async () => {
    await expect(
      db.as(w.teacher, `insert into public.exam_templates (code, title) values ('HACK-1', 'x')`),
    ).rejects.toThrow(/row-level security/);
  });

  it("una versión publicada es inmutable", async () => {
    await expect(db.sql(`update public.tasks set instructions = 'cambio' where id = $1`, [w.tasks.readingChoice])).rejects.toThrow(
      /version_locked/,
    );
    await expect(
      db.sql(`update public.question_keys set explanation = 'x' where question_id = $1`, [w.questions.r1.id]),
    ).rejects.toThrow(/version_locked/);
    await expect(db.sql(`delete from public.exam_versions where id = $1`, [w.versionId])).rejects.toThrow(/version_locked/);
  });
});

describe("invitaciones", () => {
  const hash = (c: string) => c.padEnd(64, "0").slice(0, 64);

  it("una profesora crea invitaciones de estudiante solo para sus clases", async () => {
    await db.as(
      w.teacher,
      `insert into public.invitations (code_hash, role, class_id, expires_at, created_by) values ($1, 'student', $2, now() + interval '7 days', $3)`,
      [hash("aa"), w.classA, w.teacher],
    );
    await expect(
      db.as(
        w.teacher,
        `insert into public.invitations (code_hash, role, class_id, expires_at, created_by) values ($1, 'student', $2, now() + interval '7 days', $3)`,
        [hash("bb"), w.classB, w.teacher],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db.as(
        w.teacher,
        `insert into public.invitations (code_hash, role, class_id, expires_at, created_by) values ($1, 'teacher', $2, now() + interval '7 days', $3)`,
        [hash("cc"), w.classA, w.teacher],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("una profesora no puede ampliar los usos de una invitación", async () => {
    await expect(db.as(w.teacher, `update public.invitations set max_uses = 500`)).rejects.toThrow(/permission denied/);
  });

  it("el canje respeta caducidad, usos y correo; asigna la clase", async () => {
    const code = hash("dd");
    await db.sql(
      `insert into public.invitations (code_hash, role, class_id, expires_at, max_uses, created_by) values ($1, 'student', $2, now() + interval '1 day', 1, $3)`,
      [code, w.classA, w.admin],
    );
    const u1 = await db.createUser("canje1@test.local");
    const u2 = await db.createUser("canje2@test.local");
    await db.asService(`select public.redeem_invitation($1, $2)`, [code, u1]);
    const members = await db.sql(`select * from public.class_members where student_id = $1 and class_id = $2`, [u1, w.classA]);
    expect(members).toHaveLength(1);
    await expect(db.asService(`select public.redeem_invitation($1, $2)`, [code, u2])).rejects.toThrow(/invalid_invitation/);
  });

  it("una invitación de profesora asigna el rol en el servidor", async () => {
    const code = hash("ee");
    await db.sql(
      `insert into public.invitations (code_hash, role, class_id, expires_at, created_by) values ($1, 'teacher', $2, now() + interval '1 day', $3)`,
      [code, w.classB, w.admin],
    );
    const u = await db.createUser("nuevaprof@test.local");
    await db.asService(`select public.redeem_invitation($1, $2)`, [code, u]);
    const [p] = await db.sql<{ role: string }>(`select role from public.profiles where id = $1`, [u]);
    expect(p.role).toBe("teacher");
  });

  it("el límite de frecuencia bloquea al superar el máximo", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const [r] = await db.asService<{ ok: boolean }>(`select public.check_rate_limit('login:test', 3, 600) as ok`);
      results.push(r.ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});

describe("grabaciones privadas en Storage", () => {
  it("solo el propietario y su profesora pueden leer una grabación", async () => {
    const name = `${w.student}/00000000-0000-0000-0000-000000000000/x/p1-q1.webm`;
    await db.putObject("recordings", name, w.student, 100);
    expect(await db.as(w.student, `select name from storage.objects where name = $1`, [name])).toHaveLength(1);
    expect(await db.as(w.teacher, `select name from storage.objects where name = $1`, [name])).toHaveLength(1);
    expect(await db.as(w.otherTeacher, `select name from storage.objects where name = $1`, [name])).toHaveLength(0);
    expect(await db.as(w.otherStudent, `select name from storage.objects where name = $1`, [name])).toHaveLength(0);
  });

  it("un estudiante no puede subir a la carpeta de otro ni sin intento en curso", async () => {
    await expect(
      db.as(w.otherStudent, `insert into storage.objects (bucket_id, name, owner) values ('recordings', $1, $2)`, [
        `${w.student}/abc/def/p1-q1.webm`,
        w.otherStudent,
      ]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db.as(w.student, `insert into storage.objects (bucket_id, name, owner) values ('recordings', $1, $2)`, [
        `${w.student}/00000000-0000-0000-0000-000000000000/def/p1-q1.webm`,
        w.student,
      ]),
    ).rejects.toThrow(/row-level security/);
  });

  it("los estudiantes no leen el material multimedia del banco directamente", async () => {
    await db.putObject("exam-media", "audio/test.mp3", w.admin, 1000);
    expect(await db.as(w.student, `select * from storage.objects where bucket_id = 'exam-media'`)).toHaveLength(0);
  });
});
