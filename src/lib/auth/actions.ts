"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requirePublicEnv } from "@/lib/env";
import { hashInvitationCode } from "./codes";
import { homeFor, safeNextPath, type AppRole } from "./dal";

export type FormState = { ok: boolean; error?: string; message?: string } | null;

async function clientKey(prefix: string, extra = ""): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "desconocida";
  return `${prefix}:${createHash("sha256").update(`${ip}|${extra}`).digest("hex").slice(0, 32)}`;
}

/** Límite de intentos en la base de datos (funciona también con varias instancias serverless). */
async function allowed(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!isAdminClientConfigured()) return true;
  const { data, error } = await createAdminClient().rpc("check_rate_limit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  return error ? true : Boolean(data);
}

const loginSchema = z.object({
  email: z.email("Introduzca un correo válido.").max(200),
  password: z.string().min(1, "Introduzca su contraseña.").max(200),
  next: z.string().optional(),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { email, password, next } = parsed.data;

  if (!(await allowed(await clientKey("login", email.toLowerCase()), 8, 900))) {
    return { ok: false, error: "Demasiados intentos. Espere unos minutos antes de volver a intentarlo." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }
  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).single();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: "Esta cuenta está desactivada. Contacte con la administración del centro." };
  }
  redirect(safeNextPath(next) ?? homeFor(profile.role as AppRole));
}

const registerSchema = z
  .object({
    code: z.string().min(8, "Introduzca el código de invitación.").max(40),
    fullName: z.string().trim().min(2, "Indique su nombre completo.").max(120),
    email: z.email("Introduzca un correo válido.").max(200),
    password: z
      .string()
      .min(10, "La contraseña debe tener al menos 10 caracteres.")
      .max(200)
      .regex(/[A-Za-zÀ-ÿ]/, "Incluya al menos una letra.")
      .regex(/\d/, "Incluya al menos un número."),
    confirm: z.string(),
    consent: z.literal("on", { error: "Debe aceptar el tratamiento de datos para crear la cuenta." }),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] });

/**
 * Registro con invitación. El rol nunca lo elige el usuario: lo determina la invitación en el
 * servidor. La cuenta se crea con la clave de servicio, de modo que el registro público de
 * Supabase puede (y debe) estar desactivado.
 */
export async function registerWithInvitation(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { code, fullName, email, password } = parsed.data;
  if (!isAdminClientConfigured()) return { ok: false, error: "El registro no está disponible: falta configuración del servidor." };

  if (!(await allowed(await clientKey("register"), 10, 3600))) {
    return { ok: false, error: "Demasiados intentos de registro desde esta conexión. Inténtelo más tarde." };
  }
  const admin = createAdminClient();
  const codeHash = hashInvitationCode(code);
  const { data: check } = await admin.rpc("check_invitation", { p_code_hash: codeHash, p_email: email });
  if (!check?.valid) return { ok: false, error: "El código de invitación no es válido, ha caducado o ya se usó." };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: process.env.REQUIRE_EMAIL_CONFIRMATION !== "true",
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    const exists = /already|registered|exists/i.test(createError?.message ?? "");
    return { ok: false, error: exists ? "Ya existe una cuenta con ese correo. Inicie sesión o recupere su contraseña." : "No se pudo crear la cuenta." };
  }
  const { error: redeemError } = await admin.rpc("redeem_invitation", { p_code_hash: codeHash, p_user: created.user.id });
  if (redeemError) {
    // no dejar cuentas huérfanas si el código se agotó entre la comprobación y el canje
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "El código de invitación ya no es válido." };
  }
  if (process.env.REQUIRE_EMAIL_CONFIRMATION === "true") {
    return { ok: true, message: "Cuenta creada. Revise su correo para confirmar la dirección y después inicie sesión." };
  }
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect(check.role === "teacher" ? "/profesora" : "/estudiante");
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, error: "Introduzca un correo válido." };
  if (!(await allowed(await clientKey("reset", email.data.toLowerCase()), 3, 3600))) {
    return { ok: true, message: "Si la dirección existe, recibirá un correo con instrucciones." };
  }
  const env = requirePublicEnv();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${env.siteUrl}/auth/confirm?next=/restablecer` });
  // misma respuesta exista o no la cuenta (evita enumerar usuarios)
  return { ok: true, message: "Si la dirección existe, recibirá un correo con instrucciones." };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(10, "La contraseña debe tener al menos 10 caracteres.").max(200).regex(/\d/, "Incluya al menos un número."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Las contraseñas no coinciden.", path: ["confirm"] });

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, error: "El enlace ha caducado. Solicite uno nuevo." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "No se pudo actualizar la contraseña." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", claims.claims.sub).single();
  redirect(homeFor((profile?.role as AppRole) ?? "student"));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/acceso");
}
