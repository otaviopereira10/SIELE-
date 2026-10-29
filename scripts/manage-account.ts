/**
 * Gestão de contas pela linha de comandos (usada pelos arquivos .bat da raiz do projeto).
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/manage-account.ts professora <email> "<nome>" ["<turma>"]
 *   node --env-file=.env.local --experimental-strip-types scripts/manage-account.ts aluno      <email> "<nome>" ["<turma>"]
 *   node --env-file=.env.local --experimental-strip-types scripts/manage-account.ts admin      <email> "<nome>"
 *   node --env-file=.env.local --experimental-strip-types scripts/manage-account.ts redefinir  <email>
 *
 * - Usa a chave secreta (só no servidor/computador da administração, nunca no navegador).
 * - A senha é gerada ao acaso, mostrada uma vez e anotada em ACESSOS.txt (arquivo local, fora do Git).
 * - O papel é atribuído aqui, no servidor; o perfil nasce sempre como estudante.
 * - «admin» só funciona se ainda não existir administração (regra da base de dados); as demais
 *   contas de administração se gerem no painel /admin/usuarios.
 */
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

type Kind = "professora" | "aluno" | "admin" | "redefinir";
const [kindArg, emailArg, nameArg, classArg] = process.argv.slice(2);
const kind = kindArg as Kind;
const email = emailArg?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function fail(message: string): never {
  console.error(`\nErro: ${message}`);
  process.exit(1);
}

if (!["professora", "aluno", "admin", "redefinir"].includes(kind)) fail("tipo de conta inválido (professora, aluno, admin ou redefinir).");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("informe um e-mail válido.");
if (!url || !secret) fail("faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY no .env.local.");
const fullName = (nameArg ?? "").trim().slice(0, 120);
if (kind !== "redefinir" && fullName.length < 2) fail("informe o nome completo.");
const className = (classArg ?? "").trim() || "Grupo principal";

const db = createClient(url, secret, { auth: { persistSession: false } });

/** 16 caracteres sem ambiguidades, com letras e números, em grupos de quatro. */
function password(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
  const all = `${letters}23456789`;
  const limit = 256 - (256 % all.length);
  const chars: string[] = [];
  while (chars.length < 16) for (const b of randomBytes(32)) if (b < limit && chars.length < 16) chars.push(all[b % all.length]);
  chars[3] = String((randomBytes(1)[0] % 8) + 2);
  chars[6] = letters[randomBytes(1)[0] % letters.length];
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

async function ensureClass(name: string): Promise<string> {
  const { data: found } = await db.from("classes").select("id").eq("name", name).is("archived_at", null).maybeSingle();
  if (found) return found.id;
  const { data, error } = await db.from("classes").insert({ name, description: "Turma criada pelo gerador de contas" }).select("id").single();
  if (error || !data) fail(`não foi possível criar a turma «${name}».`);
  return data.id;
}

async function assignPublishedExam(classId: string, teacherId: string | null) {
  const { data: version } = await db.from("exam_versions").select("id").eq("status", "published").order("published_at", { ascending: false }).limit(1).maybeSingle();
  if (!version) return;
  const { data: existing } = await db.from("exam_assignments").select("id").eq("class_id", classId).eq("version_id", version.id);
  if (existing?.length) return;
  // numa inserção múltipla todas as linhas precisam das mesmas colunas (senão chegam como null)
  const { error } = await db.from("exam_assignments").insert([
    { version_id: version.id, title: "Práctica con corrección inmediata", class_id: classId, mode: "practice", immediate_feedback: true, max_attempts: 5, created_by: teacherId },
    { version_id: version.id, title: "Simulacro SIELE Global (formal)", class_id: classId, mode: "formal", immediate_feedback: false, max_attempts: 2, created_by: teacherId },
  ]);
  if (error) fail(`não foi possível atribuir o simulado: ${error.message}`);
}

async function createUser(pw: string): Promise<string> {
  const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existing) fail("já existe uma conta com esse e-mail. Para trocar a senha use redefinir-senha.bat.");
  const { data, error } = await db.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) fail(`não foi possível criar a conta: ${error?.message ?? "erro desconhecido"}`);
  return data.user.id;
}

const pw = password();
let label: string;

if (kind === "redefinir") {
  const { data: profile } = await db.from("profiles").select("id, role, full_name").eq("email", email).maybeSingle();
  if (!profile) fail("não existe nenhuma conta com esse e-mail.");
  const { error } = await db.auth.admin.updateUserById(profile.id, { password: pw });
  if (error) fail(`não foi possível redefinir a senha: ${error.message}`);
  await db.from("audit_logs").insert({ actor_id: null, action: "password_reset_by_script", entity: "profile", entity_id: profile.id, details: {} });
  label = `senha redefinida (${profile.role === "teacher" ? "professora" : profile.role === "admin" ? "administração" : "aluno"})`;
} else if (kind === "professora") {
  const id = await createUser(pw);
  const { error } = await db.from("profiles").update({ role: "teacher", can_author: true, full_name: fullName }).eq("id", id);
  if (error) fail(error.message);
  const classId = await ensureClass(className);
  await db.from("teacher_assignments").upsert({ class_id: classId, teacher_id: id }, { onConflict: "class_id,teacher_id" });
  await assignPublishedExam(classId, id);
  await db.from("audit_logs").insert({ actor_id: null, action: "teacher_created_by_script", entity: "profile", entity_id: id, details: { email, class: className } });
  label = `professora · turma ${className}`;
} else if (kind === "aluno") {
  const id = await createUser(pw);
  const classId = await ensureClass(className);
  const { error } = await db.from("class_members").upsert({ class_id: classId, student_id: id }, { onConflict: "class_id,student_id" });
  if (error) fail(error.message);
  await db.from("audit_logs").insert({ actor_id: null, action: "student_created_by_script", entity: "profile", entity_id: id, details: { email, class: className } });
  label = `aluno · turma ${className}`;
} else {
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").limit(1);
  if (admins?.length) fail("já existe uma conta de administração. Crie as próximas pelo painel /admin/usuarios.");
  await createUser(pw);
  const { error } = await db.rpc("bootstrap_first_admin", { p_email: email });
  if (error) fail(error.message);
  label = "administração";
}

appendFileSync("ACESSOS.txt", `${new Date().toLocaleString("pt-BR")} | ${label} | login: ${email} | senha: ${pw} | ${site}/acceso\n`, "utf8");
console.log("\n========================================");
console.log(`  ${kind === "redefinir" ? "SENHA REDEFINIDA" : "CONTA CRIADA"} (${label})`);
console.log("========================================");
console.log(`  Acesso: ${site}/acceso`);
console.log(`  Login:  ${email}`);
console.log(`  Senha:  ${pw}`);
console.log("\nAnotado também em ACESSOS.txt (arquivo local, fora do Git).");
