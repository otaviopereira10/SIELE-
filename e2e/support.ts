import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { BrowserContext, Page } from "@playwright/test";

export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

/** Credenciales de prueba generadas por los .bat (archivo local, fuera de Git). Se usa la línea más reciente de cada login. */
export function credentials(login: string): { email: string; password: string } {
  const lines = readFileSync("ACESSOS.txt", "utf8").split(/\r?\n/);
  const line = lines.filter((l) => l.includes(`login: ${login}`)).at(-1);
  const password = line?.match(/senha: ([^\s|]+)/)?.[1];
  if (!password) throw new Error(`No hay credenciales para ${login} en ACESSOS.txt`);
  return { email: login, password };
}

/** Sesiones ya abiertas: el acceso tiene un límite de 8 intentos cada 15 minutos que estas pruebas no deben agotar. */
const sessions = new Map<string, Awaited<ReturnType<BrowserContext["cookies"]>>>();

export async function login(page: Page, who: string) {
  const cached = sessions.get(who);
  if (cached) {
    await page.context().addCookies(cached);
    return;
  }
  const { email, password } = credentials(who);
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await Promise.race([
    page.waitForURL((u) => !u.pathname.startsWith("/acceso")),
    page
      .getByText("Demasiados intentos")
      .waitFor()
      .then(() => {
        throw new Error("Se ha alcanzado el límite de accesos: espere al siguiente cuarto de hora y repita las pruebas.");
      }),
  ]);
  sessions.set(who, await page.context().cookies());
}

export const STUDENT = "aluno.teste@siele.app";
export const TEACHER = "professora@siele.app";

export interface TempAssignment {
  id: string;
  title: string;
  studentId: string;
}

/** Asignación temporal, visible solo para el alumno de prueba. */
export async function createAssignment(opts: { skills?: string[]; mode?: "practice" | "formal"; feedback?: boolean; title: string }): Promise<TempAssignment> {
  const db = admin();
  const { data: student } = await db.from("profiles").select("id").eq("email", STUDENT).single();
  const { data: version } = await db.from("exam_versions").select("id").eq("status", "published").order("published_at", { ascending: false }).limit(1).single();
  const { data: sections } = await db.from("exam_sections").select("id, skill").eq("version_id", version!.id);
  const section_ids = opts.skills ? (sections ?? []).filter((s) => opts.skills!.includes(s.skill)).map((s) => s.id) : [];
  const { data, error } = await db
    .from("exam_assignments")
    .insert({
      version_id: version!.id,
      title: opts.title,
      student_id: student!.id,
      mode: opts.mode ?? "practice",
      immediate_feedback: opts.feedback ?? false,
      section_ids,
      max_attempts: 20,
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, title: opts.title, studentId: student!.id };
}

/** Todos los archivos de audio de un intento, tengan o no una grabación registrada. */
export async function storedRecordings(studentId: string, attemptId: string): Promise<string[]> {
  const bucket = admin().storage.from("recordings");
  const root = `${studentId}/${attemptId}`;
  const { data: tasks } = await bucket.list(root, { limit: 1000 });
  const paths: string[] = [];
  for (const task of tasks ?? []) {
    const { data: files } = await bucket.list(`${root}/${task.name}`, { limit: 1000 });
    for (const file of files ?? []) paths.push(`${root}/${task.name}/${file.name}`);
  }
  return paths;
}

/** Borra los intentos, grabaciones y la asignación temporal. */
export async function removeAssignment(a: TempAssignment) {
  const db = admin();
  const { data: attempts } = await db.from("attempts").select("id").eq("assignment_id", a.id);
  for (const at of attempts ?? []) {
    const files = await storedRecordings(a.studentId, at.id);
    if (files.length) await db.storage.from("recordings").remove(files);
    await db.from("attempts").delete().eq("id", at.id);
  }
  await db.from("exam_assignments").delete().eq("id", a.id);
}

export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().includes("supabase.co")) errors.push(`http ${r.status()}: ${r.request().method()} ${r.url().split("?")[0]}`);
  });
  return errors;
}

/** Abre el intento de la asignación desde el panel del estudiante. */
export async function openAttempt(page: Page, a: TempAssignment) {
  await page.goto("/estudiante");
  const row = page.getByText(a.title, { exact: true }).first().locator("xpath=ancestor::*[.//button][1]");
  await row.getByRole("button").first().click();
  const dialogButton = page.getByRole("button", { name: "Entrar al simulacro" });
  await Promise.race([dialogButton.click({ timeout: 4000 }).catch(() => undefined), page.waitForURL(/\/estudiante\/intentos\//, { timeout: 4000 }).catch(() => undefined)]);
  await page.waitForURL(/\/estudiante\/intentos\//);
  return page.url().split("/").pop()!;
}

/** Recorre una tarea oral con sus elecciones, tiempos de lectura y grabaciones hasta completarla. */
export async function speakingTask(page: Page, doneText: string | RegExp = "Tarea completada") {
  const done = page.getByText(doneText);
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (await done.isVisible().catch(() => false)) return;
    const stop = page.getByRole("button", { name: "Terminar la grabación" });
    if (await stop.isVisible().catch(() => false)) {
      await page.waitForTimeout(2600);
      await stop.click();
      await page.waitForTimeout(300);
      continue;
    }
    const silent = page.getByRole("button", { name: "Enviar así" });
    if (await silent.isVisible().catch(() => false)) {
      await silent.click();
      continue;
    }
    for (const name of [/^Opción \d/, /^Continuar$/, /Grabar ahora/]) {
      const b = page.getByRole("main").getByRole("button", { name }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click();
        break;
      }
    }
    const rec = page.getByRole("button", { name: "Grabar", exact: true });
    if (await rec.isVisible().catch(() => false)) await rec.click();
    await page.waitForTimeout(250);
  }
  throw new Error("La tarea oral no se completó a tiempo");
}
