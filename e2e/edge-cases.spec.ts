import { expect, test, type Page } from "@playwright/test";
import { STUDENT, TEACHER, admin, createAssignment, login, openAttempt, removeAssignment, speakingTask, storedRecordings, trackErrors } from "./support";

/** Simula un micrófono con permiso que no entrega audio: lo que ocurrió en el equipo real (archivos de 5 bytes). */
async function deadMicrophone(page: Page) {
  await page.addInitScript(() => {
    const Real = window.MediaRecorder;
    class DeadRecorder extends Real {
      private stopped = false;
      set ondataavailable(fn: ((e: BlobEvent) => void) | null) {
        super.ondataavailable = fn
          ? (e: BlobEvent) => {
              const data = this.stopped ? new Blob([new Uint8Array([0x1c, 0x53, 0xbb, 0x6b, 0x80])]) : new Blob([]);
              fn(Object.assign(new Event("dataavailable"), { data, timecode: e.timecode }) as BlobEvent);
            }
          : null;
      }
      stop() {
        this.stopped = true;
        super.stop();
      }
    }
    window.MediaRecorder = DeadRecorder as typeof MediaRecorder;
  });
}

test("un micrófono sin sonido se detecta: no se puede dar por bueno ni se entrega un archivo vacío", async ({ page }) => {
  const a = await createAssignment({ skills: ["speaking"], title: "E2E micrófono sin sonido" });
  try {
    await deadMicrophone(page);
    await login(page, STUDENT);
    const attemptId = await openAttempt(page, a);

    await page.getByRole("button", { name: "Probar el micrófono" }).click();
    await expect(page.getByText("El micrófono no está enviando sonido")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Se oye bien" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Comenzar la prueba" })).toBeDisabled();

    await page.getByRole("button", { name: "No tengo micrófono" }).click();
    await page.getByRole("button", { name: "Continuar sin micrófono" }).click();
    await page.getByRole("button", { name: "Comenzar la prueba" }).click();
    await page.getByRole("button", { name: "Grabar", exact: true }).click({ timeout: 60_000 });

    await expect(page.getByText("El micrófono no está enviando sonido")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Terminar la grabación" }).click();
    await expect(page.getByText("No se ha grabado nada: el micrófono no envió sonido")).toBeVisible();

    const { data: recs } = await admin().from("oral_recordings").select("id").eq("attempt_id", attemptId);
    expect(recs).toEqual([]);
  } finally {
    await removeAssignment(a);
  }
});

test("al agotarse el tiempo se sube la grabación en curso y el intento se entrega solo", async ({ page }) => {
  const a = await createAssignment({ skills: ["speaking"], title: "E2E fin de tiempo" });
  const errors = trackErrors(page);
  try {
    await login(page, STUDENT);
    const attemptId = await openAttempt(page, a);
    await page.getByRole("button", { name: "Probar el micrófono" }).click();
    await page.getByRole("button", { name: "Se oye bien" }).click({ timeout: 15_000 });
    await page.getByRole("button", { name: "Comenzar la prueba" }).click();
    await expect(page.getByRole("button", { name: "Terminar la prueba" }).or(page.getByRole("button", { name: "Siguiente", exact: true }))).toBeVisible();

    // quedan pocos segundos de prueba: al recargar, la grabación empieza con el tiempo casi agotado
    await page.getByRole("button", { name: "Escuchar otra vez" }).or(page.getByRole("button", { name: "Escuchar la pregunta" })).first().waitFor();
    await page.waitForTimeout(800);
    const db = admin();
    const { data: sec } = await db.from("attempt_sections").select("section_id").eq("attempt_id", attemptId).eq("status", "active").single();
    await db.from("attempt_sections").update({ deadline_at: new Date(Date.now() + 25_000).toISOString() }).eq("attempt_id", attemptId).eq("section_id", sec!.section_id);
    page.once("dialog", (d) => void d.accept());
    await page.reload();

    await page.getByRole("button", { name: "Grabar", exact: true }).click({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Terminar la grabación" })).toBeVisible();
    // sin tocar nada hasta que se acaba el tiempo
    await expect(page.getByRole("heading", { name: "Su intento se ha enviado correctamente" })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("Alguna prueba se cerró al agotarse el tiempo")).toBeVisible();

    const { data: recs } = await db.from("oral_recordings").select("segment_key, size_bytes").eq("attempt_id", attemptId);
    console.log("GRABADO AL AGOTARSE", JSON.stringify(recs));
    expect(recs?.length).toBe(1);
    expect(recs?.[0].size_bytes).toBeGreaterThan(512);
    expect(errors).toEqual([]);
  } finally {
    await removeAssignment(a);
  }
});

test("en el simulacro formal, la audición pautada arranca sola", async ({ page }) => {
  const a = await createAssignment({ skills: ["listening"], mode: "formal", title: "E2E audición formal" });
  const errors = trackErrors(page);
  try {
    await login(page, STUDENT);
    await openAttempt(page, a);
    await page.getByLabel(/Confirmo que el sonido/).check();
    await page.getByRole("button", { name: "Comenzar la prueba" }).click();
    await expect(page.getByText(/Tiempo para leer las preguntas|Reproduciendo \(escucha 1/)).toBeVisible({ timeout: 20_000 });
    expect(errors).toEqual([]);
  } finally {
    await removeAssignment(a);
  }
});

test("nueva entrega de un texto: la profesora la pide y el estudiante la envía", async ({ browser }) => {
  const a = await createAssignment({ skills: ["writing"], title: "E2E nueva entrega escrita" });
  const student = await (await browser.newContext({ permissions: ["microphone"] })).newPage();
  const teacher = await (await browser.newContext()).newPage();
  try {
    await login(student, STUDENT);
    const attemptId = await openAttempt(student, a);
    await student.getByRole("button", { name: "Comenzar la prueba" }).click();
    for (let t = 1; t <= 2; t++) {
      await expect(student.getByText("Cargando la tarea")).toHaveCount(0);
      await student.waitForTimeout(400);
      const option = student.getByRole("button", { name: /Elegir opción 1/ });
      if (await option.isVisible().catch(() => false)) await option.click();
      await student.locator("main textarea").first().fill(`Primera versión de la tarea ${t}.`);
      await student.waitForTimeout(1500);
      if (t === 1) await student.getByRole("button", { name: "Siguiente", exact: true }).click();
    }
    await student.getByRole("button", { name: "Terminar la prueba" }).click();
    await student.getByRole("dialog").getByRole("button", { name: "Terminar la prueba" }).click();
    await student.getByRole("button", { name: "Enviar el intento" }).click();
    await expect(student.getByRole("heading", { name: "Su intento se ha enviado correctamente" })).toBeVisible();

    await login(teacher, TEACHER);
    await teacher.goto(`/profesora/correcciones/${attemptId}`);
    await teacher.getByRole("button", { name: "Pedir nueva entrega" }).click();
    await teacher.getByLabel("Motivo", { exact: true }).fill("Desarrolla más la conclusión, por favor.");
    await teacher.getByRole("button", { name: "Enviar la petición" }).click();
    await expect(teacher.getByText("Esperando la nueva entrega del estudiante")).toBeVisible();

    await student.goto(`/estudiante/intentos/${attemptId}`);
    await expect(student.getByText("Desarrolla más la conclusión, por favor.")).toBeVisible();
    await student.locator("main textarea").first().fill("Segunda versión, con una conclusión más desarrollada.");
    await student.waitForTimeout(1500);
    await student.getByRole("button", { name: "Entregar la nueva versión" }).click();
    await expect(student.getByRole("heading", { name: "Su intento se ha enviado correctamente" })).toBeVisible();
    const { data: att } = await admin().from("attempts").select("status").eq("id", attemptId).single();
    expect(att?.status).toBe("submitted");
  } finally {
    await student.context().close();
    await teacher.context().close();
    await removeAssignment(a);
  }
});

test("nueva grabación: la profesora la pide y el estudiante vuelve a grabar", async ({ browser }) => {
  const a = await createAssignment({ skills: ["speaking"], title: "E2E nueva grabación" });
  const student = await (await browser.newContext({ permissions: ["microphone"] })).newPage();
  const teacher = await (await browser.newContext()).newPage();
  try {
    await login(student, STUDENT);
    const attemptId = await openAttempt(student, a);
    await student.getByRole("button", { name: "Probar el micrófono" }).click();
    await student.getByRole("button", { name: "Se oye bien" }).click({ timeout: 15_000 });
    await student.getByRole("button", { name: "Comenzar la prueba" }).click();
    await speakingTask(student);
    for (let t = 2; t <= 5; t++) {
      await student.getByRole("button", { name: "Siguiente", exact: true }).click();
      await student.getByRole("button", { name: "Sí, continuar" }).click();
      await student.waitForTimeout(500);
    }
    await student.getByRole("button", { name: "Terminar la prueba" }).click();
    await student.getByRole("dialog").getByRole("button", { name: "Terminar la prueba" }).click();
    await student.getByRole("button", { name: "Enviar el intento" }).click();
    await student.getByRole("button", { name: "Enviar definitivamente" }).click();
    await expect(student.getByRole("heading", { name: "Su intento se ha enviado correctamente" })).toBeVisible();

    await login(teacher, TEACHER);
    await teacher.goto(`/profesora/correcciones/${attemptId}`);
    await teacher.getByRole("button", { name: "Pedir nueva grabación" }).click();
    await teacher.getByLabel("Motivo", { exact: true }).fill("No se oye bien: vuelve a grabar esta tarea.");
    await teacher.getByRole("button", { name: "Enviar la petición" }).click();
    await expect(teacher.getByText("Esperando la nueva entrega del estudiante")).toBeVisible();

    await student.goto(`/estudiante/intentos/${attemptId}`);
    await expect(student.getByText("No se oye bien: vuelve a grabar esta tarea.")).toBeVisible();
    await student.getByRole("button", { name: "Probar el micrófono" }).click();
    await student.getByRole("button", { name: "Se oye bien" }).click({ timeout: 15_000 });
    await speakingTask(student);
    await student.getByRole("button", { name: "Entregar las grabaciones" }).click();
    await expect(student.getByRole("heading", { name: "Su intento se ha enviado correctamente" })).toBeVisible();
    const { data: recs } = await admin().from("oral_recordings").select("status, storage_path").eq("attempt_id", attemptId);
    expect(recs?.every((r) => r.status === "verified")).toBe(true);
    // el audio sustituido no se queda en el almacenamiento: solo quedan los archivos de las grabaciones vigentes
    const registered = (recs ?? []).map((r) => r.storage_path).sort();
    await expect.poll(async () => (await storedRecordings(a.studentId, attemptId)).sort()).toEqual(registered);
    expect(registered.length).toBeGreaterThan(0);
  } finally {
    await student.context().close();
    await teacher.context().close();
    await removeAssignment(a);
  }
});
