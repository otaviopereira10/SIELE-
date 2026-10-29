import { z } from "zod";

/**
 * Configuración pública (se incrusta en el navegador). Admite los nombres nuevos de Supabase
 * (publishable key) y los clásicos (anon key).
 */
const publicSchema = z.object({
  url: z.url(),
  key: z.string().min(20),
  siteUrl: z.url(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function readPublicEnv(): PublicEnv | null {
  const parsed = publicSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  });
  return parsed.success ? parsed.data : null;
}

export function isSupabaseConfigured(): boolean {
  return readPublicEnv() !== null;
}

export function requirePublicEnv(): PublicEnv {
  const env = readPublicEnv();
  if (!env) {
    throw new Error(
      "Falta la configuración de Supabase. Defina NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (consulte README).",
    );
  }
  return env;
}
