import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type AppRole = "student" | "teacher" | "admin";

export interface CurrentProfile {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  canAuthor: boolean;
  targetLevel: string | null;
  targetDate: string | null;
}

/**
 * Capa de acceso a datos: lee la sesión verificada y el perfil desde la base de datos.
 * Se memoriza por petición. Nunca confía en datos de rol enviados por el cliente.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  // siempre por petición: nunca se pre-renderiza ni se comparte una página privada
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active, can_author, target_level, target_date")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data || !data.is_active) return null;

  return {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    role: data.role as AppRole,
    canAuthor: data.can_author,
    targetLevel: data.target_level,
    targetDate: data.target_date,
  };
});

export function homeFor(role: AppRole): string {
  return role === "admin" ? "/admin" : role === "teacher" ? "/profesora" : "/estudiante";
}

/** Exige sesión y uno de los roles indicados; si no, redirige. */
export async function requireRole(...roles: AppRole[]): Promise<CurrentProfile> {
  await connection();
  if (!isSupabaseConfigured()) redirect("/configuracion");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/acceso");
  if (!roles.includes(profile.role)) redirect(homeFor(profile.role));
  return profile;
}

export async function requireStaff(): Promise<CurrentProfile> {
  return requireRole("teacher", "admin");
}

export async function requireAuthor(): Promise<CurrentProfile> {
  const profile = await requireRole("teacher", "admin");
  if (profile.role !== "admin" && !profile.canAuthor) redirect(homeFor(profile.role));
  return profile;
}

/** Valida una ruta de retorno para evitar redirecciones abiertas. */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string") return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}
