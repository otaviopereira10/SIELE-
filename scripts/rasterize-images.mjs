// Convierte las ilustraciones SVG originales de content/images en PNG (las imágenes del banco
// se sirven como PNG; no se aceptan SVG en el bucket por seguridad).
//   node scripts/rasterize-images.mjs
import { readdirSync, readFileSync, copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "content", "images");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
mkdirSync(path.join(root, "public", "demo"), { recursive: true });
for (const file of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  const svg = readFileSync(path.join(dir, file), "utf8");
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  const out = path.join(dir, file.replace(/\.svg$/, ".png"));
  await page.locator("svg").screenshot({ path: out });
  console.log("ok", path.relative(root, out));
}
// la demostración pública usa la ilustración del parque
copyFileSync(path.join(dir, "eio-t2-parque.png"), path.join(root, "public", "demo", "demo-foto.png"));
await browser.close();
