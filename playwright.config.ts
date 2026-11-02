import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // en CI las variables llegan por el entorno
}

/**
 * Pruebas de extremo a extremo contra el proyecto de Supabase configurado en .env.local.
 * Crean una asignación temporal para el alumno de prueba y la eliminan al terminar.
 * El micrófono es el dispositivo simulado de Chromium, de modo que se comprueba la grabación real.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 15 * 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "scratch_tmp/e2e-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["microphone"],
    launchOptions: {
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
    },
  },
});
