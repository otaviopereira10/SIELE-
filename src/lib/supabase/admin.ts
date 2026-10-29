import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requirePublicEnv } from "@/lib/env";

/**
 * Cliente con la clave secreta (rol de servicio). Omite RLS: úselo SOLO en el servidor y solo
 * después de que la base de datos haya autorizado la operación con la sesión del usuario
 * (p. ej., firmar la URL de un audio tras register_audio_play) o para tareas administrativas
 * que no se pueden expresar con RLS (crear cuentas a partir de una invitación).
 */
export function createAdminClient() {
  const env = requirePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Falta SUPABASE_SECRET_KEY en el servidor (consulte README).");
  }
  return createClient(env.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function isAdminClientConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY);
}
