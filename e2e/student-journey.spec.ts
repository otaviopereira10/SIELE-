import { expect, test, type Page } from "@playwright/test";
import { PLACEMENT_BLOCKS } from "../src/content/placement";
import { getModule } from "../src/content/refuerzo";
import { STUDENT, admin, login, trackErrors } from "./support";

/** Con E2E_SHOTS=<carpeta> guarda una captura de cada paso, para revisar el aspecto. */
async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SHOTS;
  if (dir) await page.waitForTimeout(400); // que terminen las transiciones
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true, caret: "initial" });
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `desbordamiento horizontal en ${page.url()}`).toBeLessThanOrEqual(0);
}

test("un estudiante nuevo va de elegir su objetivo a su primera actividad sin perderse", async ({ page }) => {
  const db = admin();
  const { data: student } = await db.from("profiles").select("id, target_level, target_date").eq("email", STUDENT).single();
  const id = student!.id;
  const errors = trackErrors(page);
  const startedAt = new Date().toISOString();
  await db.from("profiles").update({ target_level: null, target_date: null }).eq("id", id);
  await db.from("practice_progress").delete().eq("student_id", id).eq("module_key", "prueba-nivel");
  const { data: archived } = await db.from("study_plans").update({ status: "archived" }).eq("student_id", id).eq("status", "active").select("id");
  try {
    await login(page, STUDENT);
    await page.goto("/estudiante");

    // 1. objetivo: es lo primero que se pide, y se explica cada nivel
    await expect(page.getByRole("heading", { name: "¿Qué nivel de español necesita?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar mi objetivo" })).toBeDisabled();
    await shot(page, "1-objetivo");
    await page.getByRole("radio", { name: /^B1/ }).check({ force: true });
    await page.getByRole("button", { name: "Guardar mi objetivo" }).click();
    await expect(page.getByRole("heading", { name: "Hacia el nivel B1" })).toBeVisible();

    // 2. el camino lleva a la prueba de nivel (si ya hay simulacros corregidos, el inicio propone directamente el plan)
    const { data: results } = await db.from("published_results").select("attempt_id").eq("student_id", id).limit(1);
    await expect(page.getByRole("heading", { name: results?.length ? "Cree su plan de estudio" : "Averigüe desde dónde parte" })).toBeVisible();
    await expect(page.getByText("Sin medir").first()).toBeVisible();
    await shot(page, "2-punto-de-partida");
    await page.getByRole("link", { name: /Punto de partida/ }).click();
    await page.getByRole("button", { name: "Empezar la prueba" }).click();
    await shot(page, "3-prueba");

    // aprueba A1 y A2 y no sabe nada de B1: la prueba termina ahí, sin pasar por B2 ni C1
    let asked = 0;
    for (const block of PLACEMENT_BLOCKS.slice(0, 3)) {
      for (let i = 0; i < block.questions.length; i++) {
        const shown = await page.locator("main p.text-xl").innerText();
        const question = block.questions.find((q) => q.prompt === shown);
        expect(question, `pregunta inesperada: ${shown}`).toBeDefined();
        asked++;
        if (block.level === "B1") await page.getByRole("button", { name: "No lo sé" }).click();
        else await page.getByRole("button", { name: question!.options[question!.answer], exact: true }).click();
      }
    }
    expect(asked).toBe(18);
    await expect(page.getByText("Su punto de partida")).toBeVisible();
    await expect(page.getByText("A2", { exact: true })).toBeVisible();
    await expect(page.getByText("Aprenda de lo que ha fallado")).toBeVisible();
    await shot(page, "4-resultado-prueba");
    const { data: placement } = await db.from("practice_progress").select("score").eq("student_id", id).eq("module_key", "prueba-nivel");
    expect(placement).toEqual([{ score: 2 }]);

    // 3. el plan
    await page.getByRole("link", { name: "Crear mi plan" }).click();
    await shot(page, "5-crear-plan");
    await page.getByText("15 minutos", { exact: true }).click();
    await page.getByRole("button", { name: "Crear mi plan" }).click();
    await expect(page.getByRole("heading", { name: "Hacia el nivel B1" })).toBeVisible();
    await expect(page.getByText("Hoy", { exact: true }).first()).toBeVisible();
    await shot(page, "6-plan");

    // 4. el inicio propone la primera actividad y, al hacerla, se marca sola
    await page.goto("/estudiante");
    await expect(page.getByText("Su siguiente paso")).toBeVisible();
    await shot(page, "7-inicio");
    const firstActivity = (await page.locator("#next-step-title").innerText()).trim();
    await page.getByRole("link", { name: "Empezar la actividad" }).click();
    await page.waitForURL(/\/estudiante\/refuerzo\//);
    await expect(page.getByRole("heading", { name: firstActivity })).toBeVisible();
    await shot(page, "8-leccion");

    const moduleKey = new URL(page.url()).pathname.split("/").pop()!;
    const lesson = getModule(moduleKey)!;
    const cards = page.locator("main ol").filter({ has: page.getByRole("button") }).locator("> li");
    const total = await cards.count();
    expect(total).toBe(6);
    for (let i = 0; i < total; i++) {
      const prompt = (await cards.nth(i).locator("p").first().innerText()).replace(/^\d+\.\s*/, "");
      const exercise = lesson.exercises.find((e) => e.prompt === prompt);
      expect(exercise, `ejercicio inesperado: ${prompt}`).toBeDefined();
      await cards.nth(i).getByRole("button", { name: exercise!.options[exercise!.answer], exact: true }).click();
    }
    await page.getByRole("button", { name: "Corregir" }).click();
    await expect(page.getByText("actividad marcada en su plan")).toBeVisible();
    // al guardar, la página se vuelve a pintar: el resultado y las preguntas no pueden cambiar
    await page.waitForTimeout(1000);
    await expect(page.getByText(`${total} de ${total} aciertos`)).toBeVisible();
    await expect(page.getByText("Tema dominado")).toBeVisible();
    await shot(page, "9-ejercicios-corregidos");
    await page.getByRole("link", { name: "Ver mi siguiente paso" }).click();
    await expect(page.locator("#next-step-title")).toBeVisible();

    // 5. la biblioteca muestra primero lo del objetivo
    await page.goto("/estudiante/refuerzo");
    const count = async () => Number((await page.getByRole("status").innerText()).match(/\d+/)?.[0]);
    const mine = await count();
    await page.getByRole("button", { name: "Todos los niveles" }).click();
    expect(await count()).toBeGreaterThan(mine);
    await page.getByRole("button", { name: /tema(s)? restante/ }).click();
    await expect(page.getByRole("button", { name: /tema(s)? restante/ })).toHaveCount(0);
    await page.getByRole("searchbox").fill("subjuntivo");
    await expect(page.getByText("Usos frecuentes del subjuntivo")).toBeVisible();
    await shot(page, "10-biblioteca");

    // 6. la guía dice qué hace falta para el objetivo
    await page.goto("/estudiante/guia");
    await expect(page.getByRole("row", { name: /B1/ }).getByText("Su objetivo")).toBeVisible();
    await shot(page, "11-guia");

    await page.goto("/estudiante/progreso");
    await expect(page.getByRole("heading", { name: "Cuánto le falta para B1" })).toBeVisible();
    await expect(page.getByText("Mi práctica")).toBeVisible();
    await shot(page, "12-progreso");

    // 7. práctica con material real: un texto para leer, una audición y un texto para escribir
    await page.goto("/estudiante/refuerzo/leer-b2-teletrabajo");
    await expect(page.getByText("Trabajar desde casa no es trabajar menos")).toBeVisible();
    await shot(page, "13-lectura");
    await page.goto("/estudiante/refuerzo/escuchar-b1-radio");
    await expect(page.getByRole("button", { name: "Escuchar", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Más despacio" }).click();
    await shot(page, "14-audicion");
    await page.goto("/estudiante/refuerzo/cumplir-enunciado");
    const draft = page.getByRole("textbox", { name: "Su texto" });
    await draft.fill("Hola, Ana: te escribo para contarte cómo es mi nueva casa.");
    await expect(page.getByText(/11 palabras · Le faltan palabras/)).toBeVisible();
    await page.getByRole("button", { name: "Escribir con tiempo" }).click();
    await expect(page.getByRole("timer")).toBeVisible();
    await shot(page, "15-escritura");
    // el borrador se conserva en este dispositivo
    page.once("dialog", (d) => void d.accept());
    await page.reload();
    await expect(draft).toHaveValue(/mi nueva casa/);

    // 8. el objetivo se puede guardar dos veces seguidas sin que vuelva al nivel anterior
    await page.goto("/estudiante/perfil");
    await page.getByRole("radio", { name: /^C1/ }).check({ force: true });
    await page.getByRole("button", { name: "Guardar mi objetivo" }).click();
    await expect(page.getByText("Objetivo guardado.")).toBeVisible();
    await page.waitForTimeout(800);
    await page.getByLabel("Fecha del examen (opcional)").fill("2030-06-15");
    await page.getByRole("button", { name: "Guardar mi objetivo" }).click();
    await expect.poll(async () => (await db.from("profiles").select("target_level, target_date").eq("id", id).single()).data).toEqual({ target_level: "C1", target_date: "2030-06-15" });

    // 9. con otro objetivo, el inicio pide actualizar el plan
    await page.goto("/estudiante");
    await expect(page.getByRole("heading", { name: "Su plan sigue orientado al nivel B1" })).toBeVisible();
    await page.getByRole("link", { name: "Actualizar mi plan" }).click();
    await expect(page.getByRole("button", { name: "Sustituir mi plan" })).toBeVisible();

    // en un teléfono, nada se sale de la pantalla
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of ["/estudiante", "/estudiante/plan", "/estudiante/refuerzo", `/estudiante/refuerzo/${moduleKey}`, "/estudiante/prueba-de-nivel", "/estudiante/progreso", "/estudiante/guia", "/estudiante/perfil"]) {
      await page.goto(path);
      await noHorizontalScroll(page);
      await shot(page, `m${path.replaceAll("/", "-")}`);
    }

    expect(errors).toEqual([]);
  } finally {
    await db.from("profiles").update({ target_level: student!.target_level, target_date: student!.target_date }).eq("id", id);
    await db.from("practice_progress").delete().eq("student_id", id).gte("completed_at", startedAt);
    await db.from("study_plans").delete().eq("student_id", id).eq("status", "active");
    if (archived?.length) await db.from("study_plans").update({ status: "active" }).in("id", archived.map((p) => p.id));
  }
});

test("sin iniciar sesión, las páginas públicas también caben en un teléfono", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = trackErrors(page);
  for (const path of ["/", "/acceso", "/registro", "/recuperar", "/demo"]) {
    await page.goto(path);
    await noHorizontalScroll(page);
    await shot(page, `publica${path.replaceAll("/", "-")}`);
  }
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cómo funciona" })).toBeVisible();
  expect(errors).toEqual([]);
});
