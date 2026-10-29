// Aplica las migraciones de supabase/migrations en orden, cada una en su propia transacción.
// Registra lo aplicado en supabase_migrations.schema_migrations (mismo formato que la CLI de
// Supabase), de modo que se puede seguir usando `supabase db push` más adelante.
//
//   node --env-file=.env.local scripts/apply-migrations.mjs          (aplica las pendientes)
//   node --env-file=.env.local scripts/apply-migrations.mjs --status (solo muestra el estado)
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "supabase", "migrations");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL (cadena de conexión de Postgres, modo sesión, puerto 5432) en .env.local");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
try {
  await sql.unsafe(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key, statements text[], name text
    );`);
  const applied = new Set((await sql`select version from supabase_migrations.schema_migrations`).map((r) => r.version));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const pending = files.filter((f) => !applied.has(f.split("_")[0]));

  for (const f of files) console.log(`${applied.has(f.split("_")[0]) ? "aplicada " : "pendiente"}  ${f}`);
  if (process.argv.includes("--status")) process.exit(0);
  if (pending.length === 0) {
    console.log("\nNo hay migraciones pendientes.");
    process.exit(0);
  }

  for (const f of pending) {
    const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
    const text = readFileSync(path.join(dir, f), "utf8");
    process.stdout.write(`\nAplicando ${f}… `);
    await sql.begin(async (tx) => {
      await tx.unsafe(text);
      await tx`insert into supabase_migrations.schema_migrations (version, statements, name)
               values (${version}, ${[text]}, ${rest.join("_")})`;
    });
    console.log("ok");
  }
  // que la API (PostgREST) vea las tablas y funciones nuevas de inmediato
  await sql`notify pgrst, 'reload schema'`;
  console.log("\nMigraciones aplicadas.");
} catch (error) {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
