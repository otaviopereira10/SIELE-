import { expect, test, type Page } from "@playwright/test";
import { STUDENT, TEACHER, admin, createAssignment, login, openAttempt, removeAssignment, speakingTask, trackErrors, type TempAssignment } from "./support";

const SHOTS = "scratch_tmp/e2e-shots";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false, caret: "initial" });
}

/** Responde todo lo que haya en la tarea objetiva visible. */
async function answerObjective(page: Page) {
  const radios = page.locator("fieldset");
  for (let i = 0; i < (await radios.count()); i++) await radios.nth(i).locator('input[type="radio"]').first().check();
  const selects = page.locator("main select");
  for (let i = 0; i < (await selects.count()); i++) {
    const select = selects.nth(i);
    if (await select.isDisabled()) continue;
    const value = await select.evaluate((el: HTMLSelectElement) => [...el.options].find((o) => o.value && !o.disabled)?.value ?? "");
    if (value) await select.selectOption(value);
  }
  const checks = page.locator('main input[type="checkbox"]');
  for (let i = 0; i < (await checks.count()); i++) {
    if (await checks.nth(i).isEnabled()) await checks.nth(i).check();
  }
}

async function nextOrFinish(page: Page) {
  const next = page.getByRole("button", { name: "Siguiente", exact: true });
  if (await next.isVisible().catch(() => false)) {
    await next.click();
    const confirm = page.getByRole("button", { name: "Sí, continuar" });
    if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
    return false;
  }
  await page.getByRole("button", { name: "Terminar la prueba" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Terminar la prueba" }).click();
  return true;
}

async function comprehensionSection(page: Page, tasks: number, listen: boolean) {
  await page.getByRole("button", { name: "Comenzar la prueba" }).click();
  for (let t = 1; t <= tasks; t++) {
    await expect(page.getByRole("navigation", { name: "Tareas de la prueba" }).getByRole("button", { name: new RegExp(`Tarea ${t}`) })).toHaveAttribute("aria-current", "step");
    await expect(page.getByText("Cargando la tarea")).toHaveCount(0);
    await page.waitForTimeout(400);
    if (listen && t === 1) {
      await page.getByRole("button", { name: "Escuchar" }).first().click();
      await expect(page.getByText(/Reproduciendo \(escucha 1/)).toBeVisible();
      await shot(page, "01-listening");
    }
    await answerObjective(page);
    await page.waitForTimeout(600);
    await nextOrFinish(page);
  }
}

async function writingSection(page: Page) {
  await page.getByRole("button", { name: "Comenzar la prueba" }).click();
  for (let t = 1; t <= 2; t++) {
    await expect(page.getByText("Cargando la tarea")).toHaveCount(0);
    await page.waitForTimeout(400);
    const option = page.getByRole("button", { name: /Elegir opción 1/ });
    if (await option.isVisible().catch(() => false)) await option.click();
    await page.locator("main textarea").first().fill(`Texto de prueba de la tarea ${t}. Ayer fui al mercado con mi familia y compramos fruta fresca para toda la semana porque nos gusta comer bien.`);
    await page.waitForTimeout(1500);
    await nextOrFinish(page);
  }
}

test.describe.serial("simulacro completo: estudiante y profesora", () => {
  let assignment: TempAssignment;
  let attemptId: string;

  test.beforeAll(async () => {
    assignment = await createAssignment({ title: "E2E simulacro completo", mode: "practice", feedback: false });
  });
  test.afterAll(async () => {
    if (assignment && !process.env.E2E_KEEP) await removeAssignment(assignment);
  });

  test("el estudiante hace las cuatro pruebas y envía el intento", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page, STUDENT);
    attemptId = await openAttempt(page, assignment);

    await comprehensionSection(page, 5, false);
    await page.getByLabel(/Confirmo que el sonido/).check();
    await comprehensionSection(page, 6, true);
    await writingSection(page);

    await shot(page, "02-mic-check");
    await page.getByRole("button", { name: "Probar el micrófono" }).click();
    await page.getByRole("button", { name: "Se oye bien" }).click({ timeout: 15_000 });
    await page.getByRole("button", { name: "Comenzar la prueba" }).click();

    for (let t = 1; t <= 5; t++) {
      await expect(page.getByText("Cargando la tarea")).toHaveCount(0);
      await speakingTask(page);
      await shot(page, `03-speaking-t${t}`);
      await nextOrFinish(page);
      await page.waitForTimeout(500);
    }

    await expect(page.getByRole("heading", { name: "Ha completado todas las pruebas" })).toBeVisible();
    await shot(page, "04-final-review");
    await page.getByRole("button", { name: "Enviar el intento" }).click();
    const force = page.getByRole("button", { name: "Enviar definitivamente" });
    if (await force.isVisible({ timeout: 3000 }).catch(() => false)) await force.click();
    await expect(page.getByRole("heading", { name: "Su intento se ha enviado correctamente" })).toBeVisible();
    await shot(page, "05-submitted");

    const db = admin();
    const { data: recs } = await db.from("oral_recordings").select("task_id, part_key, segment_key, size_bytes, duration_ms, status").eq("attempt_id", attemptId);
    console.log("GRABACIONES", JSON.stringify(recs?.map((r) => [r.part_key, r.segment_key, r.size_bytes, r.duration_ms])));
    expect(recs?.length).toBeGreaterThanOrEqual(8);
    for (const r of recs ?? []) expect(r.size_bytes).toBeGreaterThan(512);
    const { data: events } = await db.from("attempt_events").select("event_type").eq("attempt_id", attemptId);
    const types = new Set(events?.map((e) => e.event_type));
    expect(types.has("mic_check_ok"), "el evento de micrófono debe llegar al servidor").toBe(true);
    const { data: att } = await db.from("attempts").select("status").eq("id", attemptId).single();
    expect(att?.status).toBe("submitted");
    console.log("ERRORES ESTUDIANTE", JSON.stringify(errors, null, 1));
    expect(errors).toEqual([]);
  });

  test("la profesora escucha, comenta, evalúa y publica", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page, TEACHER);
    await page.goto("/profesora/correcciones");
    await shot(page, "10-queue");
    await page.goto(`/profesora/correcciones/${attemptId}`);
    await expect(page.getByRole("navigation", { name: "Pasos de la corrección" })).toBeVisible();
    await shot(page, "11-writing");

    const rail = page.getByRole("navigation", { name: "Pasos de la corrección" }).getByRole("button");
    const taskCount = (await rail.count()) - 1;
    expect(taskCount).toBe(7);

    // escrita: seleccionar un fragmento y comentarlo
    const text = page.locator(".reading-text").first();
    await text.evaluate((el) => {
      const node = [...el.childNodes].find((n) => n.nodeType === 3)!;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, 20);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    });
    await text.dispatchEvent("mouseup");
    await page.getByRole("toolbar", { name: "Comentar el fragmento seleccionado" }).getByRole("button", { name: "A corregir" }).click();
    await page.getByLabel("Tipo de error o aspecto").selectOption({ index: 1 });
    await page.getByLabel("Explicación para el estudiante").fill("Observación de prueba sobre el fragmento.");
    await shot(page, "12-annotation");
    await page.getByRole("button", { name: "Guardar observación" }).click();
    await expect(page.getByText("Observación de prueba sobre el fragmento.")).toBeVisible();

    for (let i = 0; i < taskCount; i++) {
      await page.waitForTimeout(500);
      const players = page.getByLabel("Reproductor de la grabación");
      if (i === 2) {
        // primera tarea oral: el audio se carga, suena y se puede saltar a otro punto
        await expect(players.first()).toBeVisible();
        const play = players.first().getByRole("button", { name: "Reproducir" });
        await expect(play).toBeEnabled({ timeout: 20_000 });
        await expect(page.getByText("Grabación vacía")).toHaveCount(0);
        await shot(page, "13-speaking-ready");
        await play.click();
        await page.waitForTimeout(1200);
        const slider = players.first().getByRole("slider");
        const now = Number(await slider.getAttribute("aria-valuenow"));
        const max = Number(await slider.getAttribute("aria-valuemax"));
        console.log("AUDIO", { now, max });
        expect(max).toBeGreaterThan(1);
        expect(now).toBeGreaterThanOrEqual(0);
        const box = (await slider.boundingBox())!;
        await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
        await page.waitForTimeout(300);
        const after = Number(await slider.getAttribute("aria-valuenow"));
        console.log("SALTO", { after, max });
        expect(after).toBeGreaterThanOrEqual(Math.floor(max * 0.5));
        await players.first().getByRole("button", { name: "Comentar este momento" }).click();
        await page.getByLabel("Tipo de error o aspecto").selectOption({ index: 1 });
        await page.getByLabel("Explicación para el estudiante").fill("Pronunciación mejorable en este punto.");
        await shot(page, "14-speaking-annotation");
        await page.getByRole("button", { name: "Guardar observación" }).click();
        await expect(page.getByText("Pronunciación mejorable en este punto.")).toBeVisible();
        // el reproductor no se reinicia al refrescarse la página tras guardar
        await expect(players.first().getByRole("button", { name: "Reproducir" }).or(players.first().getByRole("button", { name: "Pausar" }))).toBeEnabled();
      }
      const groups = page.getByRole("radiogroup").filter({ has: page.getByRole("radio", { name: "3", exact: true }) });
      for (let g = 0; g < (await groups.count()); g++) await groups.nth(g).getByRole("radio", { name: "3", exact: true }).click();
      await page.getByLabel("Lo que hizo bien").fill("Buen uso de los conectores.");
      await expect(page.getByText(/Guardado a las/)).toBeVisible({ timeout: 15_000 });
      if (i === 0) await shot(page, "15-rubric-complete");
      await page.getByRole("complementary", { name: "Evaluación" }).getByRole("button", { name: /Pasar a|Ir al resumen/ }).click();
    }

    await expect(page.getByRole("heading", { name: "Todo listo para publicar" })).toBeVisible();
    await shot(page, "16-summary");
    await page.getByRole("button", { name: "Publicar resultados" }).last().click();
    await expect(page.getByText("Resultados publicados. El estudiante ya puede ver el informe.")).toBeVisible();
    await shot(page, "17-published");
    const { data: att } = await admin().from("attempts").select("status").eq("id", attemptId).single();
    expect(att?.status).toBe("published");
    console.log("ERRORES PROFESORA", JSON.stringify(errors, null, 1));
    expect(errors).toEqual([]);
  });

  test("el estudiante ve su informe con las grabaciones", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page, STUDENT);
    await page.goto(`/estudiante/resultados/${attemptId}`);
    await expect(page.getByText("Buen uso de los conectores.").first()).toBeVisible();
    await expect(page.getByText("Pronunciación mejorable en este punto.")).toBeVisible();
    const play = page.getByLabel("Reproductor de la grabación").first().getByRole("button", { name: "Reproducir" });
    await play.click();
    await expect(page.getByLabel("Reproductor de la grabación").first().getByRole("button", { name: "Pausar" })).toBeVisible({ timeout: 20_000 });
    await shot(page, "20-report");
    expect(errors).toEqual([]);
  });

  test("las actividades de refuerzo y el plan se guardan", async ({ page }) => {
    const errors = trackErrors(page);
    await login(page, STUDENT);
    await page.goto("/estudiante/refuerzo");
    await page.locator('main a[href^="/estudiante/refuerzo/"]').first().click();
    await page.waitForURL(/\/estudiante\/refuerzo\/.+/);
    const items = page.locator("main ol > li").filter({ has: page.locator("button[aria-pressed]") });
    for (let i = 0; i < (await items.count()); i++) await items.nth(i).locator("button[aria-pressed]").first().click();
    await page.getByRole("button", { name: "Corregir" }).click();
    await expect(page.getByText("Resultado guardado en su progreso.")).toBeVisible();
    await shot(page, "30-drill");

    await page.goto("/estudiante/plan");
    await page.getByRole("button", { name: /Generar|Crear/ }).first().click();
    await expect(page.getByText("Plan creado.").or(page.locator('input[type="checkbox"]').first())).toBeVisible();
    await shot(page, "31-plan");
    console.log("ERRORES ACTIVIDADES", JSON.stringify(errors, null, 1));
    expect(errors).toEqual([]);
  });
});
