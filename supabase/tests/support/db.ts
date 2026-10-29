import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");
const migrationsDir = path.join(root, "migrations");

export type Role = "student" | "teacher" | "admin";

/**
 * Base de datos Postgres real (PGlite) con las migraciones del proyecto aplicadas.
 * Permite ejecutar consultas como un usuario autenticado concreto para probar RLS y las RPC.
 */
export class TestDb {
  private constructor(readonly pg: PGlite) {}

  static async create(): Promise<TestDb> {
    const pg = new PGlite();
    await pg.exec(readFileSync(path.join(__dirname, "supabase-shim.sql"), "utf8"));
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      try {
        await pg.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
      } catch (error) {
        throw new Error(`Fallo al aplicar ${file}: ${(error as Error).message}`);
      }
    }
    // Supabase concede a service_role acceso completo (con bypass de RLS)
    await pg.exec(`
      grant all on all tables in schema public to service_role;
      grant execute on all functions in schema public to service_role;
    `);
    return new TestDb(pg);
  }

  async close() {
    await this.pg.close();
  }

  /** Ejecuta como superusuario (equivale al editor SQL / migraciones). */
  async sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
    const res = await this.pg.query<T>(query, params);
    return res.rows;
  }

  /** Ejecuta como un usuario autenticado (rol `authenticated` con su JWT). */
  async as<T = Record<string, unknown>>(userId: string | null, query: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec(
      `set role ${userId ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false);`,
    );
    try {
      const res = await this.pg.query<T>(query, params);
      return res.rows;
    } finally {
      await this.pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  }

  /** Llama a una RPC como usuario y devuelve el primer valor. */
  async rpc<T = unknown>(userId: string | null, fn: string, args: unknown[] = []): Promise<T> {
    const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await this.as<{ r: T }>(userId, `select public.${fn}(${placeholders}) as r`, args);
    return rows[0]?.r as T;
  }

  async asService<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
    await this.pg.exec(`set role service_role;`);
    try {
      return (await this.pg.query<T>(query, params)).rows;
    } finally {
      await this.pg.exec(`reset role;`);
    }
  }

  async createUser(email: string, role: Role = "student", fullName = "Usuario de prueba"): Promise<string> {
    const [row] = await this.sql<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
      [email, JSON.stringify({ full_name: fullName, role: "admin" })],
    );
    if (role !== "student") {
      await this.sql(`update public.profiles set role = $1 where id = $2`, [role, row.id]);
    }
    return row.id;
  }

  /** Simula una subida a Storage (lo haría el cliente con su sesión). */
  async putObject(bucket: string, name: string, owner: string, size: number) {
    await this.sql(`insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)`, [
      bucket,
      name,
      owner,
      JSON.stringify({ size, mimetype: "audio/webm" }),
    ]);
  }

  /** Mueve el reloj de un intento hacia atrás para simular el paso del tiempo. */
  async shiftAttemptTime(attemptId: string, seconds: number) {
    await this.sql(
      `update public.attempt_sections set started_at = started_at - make_interval(secs => $2),
         deadline_at = deadline_at - make_interval(secs => $2),
         available_at = available_at - make_interval(secs => $2)
       where attempt_id = $1`,
      [attemptId, seconds],
    );
  }
}
