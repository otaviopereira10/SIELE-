/**
 * Gera um código de acesso (convite) para estudantes criarem a conta.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/create-student-code.ts [--usos 1] [--dias 14] [--clase "Grupo principal"] [--email aluno@dominio]
 *
 * O banco guarda só o hash do código; o código em claro aparece aqui uma única vez e é anotado em
 * CODIGOS-ESTUDANTES.txt (arquivo local, fora do Git) para consulta.
 */
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { generateInvitationCode, hashInvitationCode } from "../src/lib/auth/code-format.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const uses = Number(arg("usos") ?? 1);
const days = Number(arg("dias") ?? 14);
const className = arg("clase");
const email = arg("email")?.trim().toLowerCase() || null;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

if (!Number.isInteger(uses) || uses < 1 || uses > 200) {
  console.error("O número de usos deve ser um inteiro entre 1 e 200.");
  process.exit(1);
}
if (!Number.isInteger(days) || days < 1 || days > 60) {
  console.error("A validade deve ser um número inteiro de dias entre 1 e 60.");
  process.exit(1);
}
if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("E-mail inválido.");
  process.exit(1);
}
if (!url || !secret) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });

// turma: a indicada ou a única/mais antiga ativa
let query = db.from("classes").select("id, name, teacher_assignments(teacher_id)").is("archived_at", null).order("created_at");
if (className) query = query.eq("name", className);
const { data: classes, error: classError } = await query;
if (classError) throw classError;
const cls = classes?.[0];
if (!cls) {
  console.error(className ? `Turma «${className}» não encontrada.` : "Não há nenhuma turma. Crie a conta da professora primeiro (cria a turma).");
  process.exit(1);
}
// o código aparece na lista de convites da professora da turma
const teacherId = (cls.teacher_assignments as { teacher_id: string }[])[0]?.teacher_id ?? null;

const code = generateInvitationCode();
const expires = new Date(Date.now() + days * 86_400_000);
const { error } = await db.from("invitations").insert({
  code_hash: hashInvitationCode(code),
  code_hint: code.slice(-4),
  role: "student",
  class_id: cls.id,
  email,
  max_uses: uses,
  expires_at: expires.toISOString(),
  note: "Gerado pelo arquivo gerar-codigo-estudante.bat",
  created_by: teacherId,
});
if (error) throw error;

const link = `${site}/registro?codigo=${code}`;
appendFileSync(
  "CODIGOS-ESTUDANTES.txt",
  `${new Date().toLocaleString("pt-BR")} | código: ${code} | turma: ${cls.name} | usos: ${uses} | válido até: ${expires.toLocaleDateString("pt-BR")}${email ? ` | só para: ${email}` : ""} | ${link}\n`,
  "utf8",
);

console.log("\n========================================");
console.log(`  CÓDIGO DE ACESSO:  ${code}`);
console.log("========================================");
console.log(`  Turma:        ${cls.name}`);
console.log(`  Pode ser usado por: ${uses} ${uses === 1 ? "aluno" : "alunos"}${email ? ` (somente ${email})` : ""}`);
console.log(`  Válido até:   ${expires.toLocaleDateString("pt-BR")}`);
console.log(`  Link direto:  ${link}`);
console.log("\nO aluno abre o link (ou a página «Crear cuenta») e informa o código.");
console.log("Anotado também em CODIGOS-ESTUDANTES.txt.");
