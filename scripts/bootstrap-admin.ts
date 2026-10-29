/**
 * Crea (o promueve) la primera cuenta de administración de forma segura.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/bootstrap-admin.ts admin@centro.edu "Nombre Apellido"
 *
 * - Solo funciona si todavía no existe ningún administrador (lo comprueba la base de datos).
 * - No crea contraseñas: genera un enlace de invitación de un solo uso para que la persona
 *   defina su propia contraseña. El enlace se muestra en la consola una única vez.
 * - Se ejecuta en el servidor con la clave secreta; nunca desde el navegador.
 */
import { createClient } from "@supabase/supabase-js";

const [email, fullName = ""] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: scripts/bootstrap-admin.ts correo@dominio "Nombre completo"');
  process.exit(1);
}
if (!url || !secret) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { persistSession: false } });

const { data: admins, error: adminsError } = await db.from("profiles").select("id").eq("role", "admin").limit(1);
if (adminsError) throw adminsError;
if (admins.length > 0) {
  console.error("Ya existe un administrador. Gestione los roles desde el panel /admin/usuarios.");
  process.exit(1);
}

const { data: link, error: linkError } = await db.auth.admin.generateLink({
  type: "invite",
  email,
  options: { data: { full_name: fullName }, redirectTo: `${site}/auth/confirm?next=/restablecer` },
});
let actionLink = link?.properties?.action_link ?? null;
if (linkError) {
  // la cuenta ya existe: enlace de recuperación para que defina su contraseña
  const { data: recovery, error: recoveryError } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${site}/auth/confirm?next=/restablecer` },
  });
  if (recoveryError) throw recoveryError;
  actionLink = recovery.properties?.action_link ?? null;
}

const { error: rpcError } = await db.rpc("bootstrap_first_admin", { p_email: email });
if (rpcError) throw rpcError;
if (fullName) await db.from("profiles").update({ full_name: fullName }).eq("email", email);

console.log(`\nAdministrador configurado: ${email}`);
console.log("Abra este enlace de un solo uso para definir la contraseña (caduca según la configuración de Supabase Auth):\n");
console.log(actionLink);
console.log("\nNo comparta este enlace. Si caduca, use «¿Ha olvidado su contraseña?» en la pantalla de acceso.");
