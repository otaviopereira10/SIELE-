/**
 * Crea la cuenta de una profesora (o le genera una contraseña nueva) y la vincula a una clase.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/create-teacher.ts correo@dominio "Nombre" ["Nombre de la clase"]
 *   node --env-file=.env.local --experimental-strip-types scripts/create-teacher.ts correo@dominio --redefinir
 *
 * - Usa la clave secreta (solo servidor). La contraseña se genera al azar, se muestra una vez y se
 *   guarda en ACESSO-PROFESSORA.txt (archivo local, excluido de Git).
 * - Crea la clase si no existe, concede acceso a la profesora, le permite editar simulacros y
 *   asigna a la clase el simulacro publicado más reciente (práctica y formal).
 */
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const email = args[0]?.trim().toLowerCase();
const reset = args.includes("--redefinir");
const fullName = (!reset && args[1]) || "Professora";
const className = (!reset && args[2]) || "Grupo principal";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: create-teacher.ts correo@dominio "Nombre" ["Clase"]   |   create-teacher.ts correo@dominio --redefinir');
  process.exit(1);
}
if (!url || !secret) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });

function password(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const limit = 256 - (256 % alphabet.length);
  const chars: string[] = [];
  while (chars.length < 16) for (const b of randomBytes(32)) if (b < limit && chars.length < 16) chars.push(alphabet[b % alphabet.length]);
  // garantiza letras y números
  chars[3] = String((randomBytes(1)[0] % 8) + 2);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12).join("")}`;
}

async function findUser(mail: string) {
  const { data: profile } = await db.from("profiles").select("id, role").eq("email", mail).maybeSingle();
  return profile;
}

const pw = password();
let userId: string;
const existing = await findUser(email);

if (reset) {
  if (!existing) {
    console.error("No existe ninguna cuenta con ese correo.");
    process.exit(1);
  }
  const { error } = await db.auth.admin.updateUserById(existing.id, { password: pw, ban_duration: "none" });
  if (error) throw error;
  userId = existing.id;
} else {
  if (existing) {
    console.error("Ya existe una cuenta con ese correo. Use --redefinir para generar una contraseña nueva.");
    process.exit(1);
  }
  const { data, error } = await db.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error || !data.user) throw error ?? new Error("No se pudo crear la cuenta.");
  userId = data.user.id;
  // el perfil nace siempre como estudiante; el rol lo asigna el servidor (queda auditado)
  const { error: roleError } = await db.from("profiles").update({ role: "teacher", can_author: true, full_name: fullName }).eq("id", userId);
  if (roleError) throw roleError;
  await db.from("audit_logs").insert({ actor_id: null, action: "teacher_created_by_script", entity: "profile", entity_id: userId, details: { email } });

  let { data: cls } = await db.from("classes").select("id").eq("name", className).is("archived_at", null).maybeSingle();
  if (!cls) {
    ({ data: cls } = await db.from("classes").insert({ name: className, description: "Clase creada al configurar la plataforma" }).select("id").single());
  }
  if (!cls) throw new Error("No se pudo crear la clase.");
  await db.from("teacher_assignments").upsert({ class_id: cls.id, teacher_id: userId }, { onConflict: "class_id,teacher_id" });

  const { data: version } = await db
    .from("exam_versions")
    .select("id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (version) {
    const { data: existingAsg } = await db.from("exam_assignments").select("id").eq("class_id", cls.id).eq("version_id", version.id);
    if (!existingAsg?.length) {
      // en una inserción múltiple todas las filas deben llevar las mismas columnas (si no, llegan como null)
      const { error: asgError } = await db.from("exam_assignments").insert([
        { version_id: version.id, title: "Práctica con corrección inmediata", class_id: cls.id, mode: "practice", immediate_feedback: true, max_attempts: 5, created_by: userId },
        { version_id: version.id, title: "Simulacro SIELE Global (formal)", class_id: cls.id, mode: "formal", immediate_feedback: false, max_attempts: 2, created_by: userId },
      ]);
      if (asgError) throw asgError;
    }
  }
}

const line = `${new Date().toLocaleString("pt-BR")} | ${reset ? "senha redefinida" : "conta criada"} | login: ${email} | senha: ${pw} | acesso: ${site}/acceso\n`;
appendFileSync("ACESSO-PROFESSORA.txt", line, "utf8");
console.log(`\n${reset ? "Senha redefinida" : "Conta da professora criada"}.`);
console.log(`  Acesso: ${site}/acceso`);
console.log(`  Login:  ${email}`);
console.log(`  Senha:  ${pw}`);
console.log("\nGuardado também em ACESSO-PROFESSORA.txt (arquivo local, fora do Git).");
