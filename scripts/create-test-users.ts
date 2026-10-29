/**
 * Crea usuarios de PRUEBA en un entorno separado (nunca en producción).
 *
 *   ALLOW_TEST_USERS=true node --env-file=.env.test --experimental-strip-types scripts/create-test-users.ts
 *
 * - Exige ALLOW_TEST_USERS=true y que APP_ENV no sea "production".
 * - Genera contraseñas aleatorias que se muestran una sola vez en la consola (no se guardan).
 * - Crea una clase de prueba con una profesora y dos estudiantes, y asigna el simulacro publicado.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

if (process.env.ALLOW_TEST_USERS !== "true" || process.env.APP_ENV === "production") {
  console.error("Bloqueado: defina ALLOW_TEST_USERS=true y use un proyecto de pruebas (APP_ENV distinto de production).");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!;
const db = createClient(url, secret, { auth: { persistSession: false } });
const domain = process.env.TEST_USERS_DOMAIN ?? "pruebas.invalid";

const password = () => `${randomBytes(9).toString("base64url")}-${randomBytes(3).toString("hex")}`;
const accounts = [
  { email: `profesora@${domain}`, name: "Profesora de prueba", role: "teacher" as const },
  { email: `estudiante1@${domain}`, name: "Estudiante Uno", role: "student" as const },
  { email: `estudiante2@${domain}`, name: "Estudiante Dos", role: "student" as const },
];

const created: { email: string; password: string; role: string; id: string }[] = [];
for (const a of accounts) {
  const pw = password();
  const { data, error } = await db.auth.admin.createUser({ email: a.email, password: pw, email_confirm: true, user_metadata: { full_name: a.name } });
  if (error) {
    console.error(`No se pudo crear ${a.email}: ${error.message}`);
    continue;
  }
  if (a.role === "teacher") await db.from("profiles").update({ role: "teacher" }).eq("id", data.user.id);
  created.push({ email: a.email, password: pw, role: a.role, id: data.user.id });
}

const { data: cls } = await db.from("classes").insert({ name: "Grupo de prueba", description: "Creado por scripts/create-test-users.ts" }).select("id").single();
if (cls) {
  for (const c of created) {
    if (c.role === "teacher") await db.from("teacher_assignments").insert({ class_id: cls.id, teacher_id: c.id });
    else await db.from("class_members").insert({ class_id: cls.id, student_id: c.id });
  }
  const { data: version } = await db.from("exam_versions").select("id").eq("status", "published").order("published_at", { ascending: false }).limit(1).maybeSingle();
  const teacher = created.find((c) => c.role === "teacher");
  if (version && teacher) {
    const { error: asgError } = await db.from("exam_assignments").insert([
      { version_id: version.id, title: "Simulacro completo (formal)", class_id: cls.id, mode: "formal", immediate_feedback: false, created_by: teacher.id, max_attempts: 2 },
      { version_id: version.id, title: "Práctica con corrección inmediata", class_id: cls.id, mode: "practice", immediate_feedback: true, created_by: teacher.id, max_attempts: 5 },
    ]);
    if (asgError) console.error(`No se pudieron asignar los simulacros: ${asgError.message}`);
  }
}

console.log("\nUsuarios de prueba (las contraseñas no se guardan en ningún sitio; cópielas ahora):\n");
for (const c of created) console.log(`${c.role.padEnd(8)} ${c.email.padEnd(32)} ${c.password}`);
