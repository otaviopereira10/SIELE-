import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requirePublicEnv } from "@/lib/env";

/**
 * Cliente de Supabase con la sesión del usuario: todas las consultas pasan por RLS.
 * Úselo en Server Components, Server Actions y Route Handlers.
 */
export async function createClient() {
  const env = requirePublicEnv();
  const cookieStore = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Llamado desde un Server Component: el proxy ya renueva la sesión.
        }
      },
    },
  });
}
