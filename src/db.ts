import pg from "pg";
import { attachDatabasePool } from "@neon/functions";
import { MIGRATIONS } from "./migrations.js";

const { Pool } = pg;

// DATE columns come back as 'YYYY-MM-DD' strings instead of JS Dates (no timezone shifts).
pg.types.setTypeParser(1082, (v: string) => v);
// NUMERIC -> number
pg.types.setTypeParser(1700, (v: string) => (v === null ? null : Number(v)));
// BIGINT (count(*)) -> number
pg.types.setTypeParser(20, (v: string) => Number(v));

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString, max: 5 });
    attachDatabasePool(pool);
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as any[]);
  return res.rows;
}

let migrated: Promise<void> | undefined;

/** Applies pending migrations once per process (idempotent, guarded by an advisory lock). */
export function ensureSchema(connectionString?: string): Promise<void> {
  if (!migrated) {
    migrated = runMigrations(connectionString).catch((err) => {
      migrated = undefined;
      throw err;
    });
  }
  return migrated;
}

async function runMigrations(connectionString?: string): Promise<void> {
  // A PoolClient is also an instance of pg.Client, so track ownership explicitly.
  const own = connectionString ? new pg.Client({ connectionString }) : null;
  if (own) await own.connect();
  const client: pg.ClientBase = own ?? (await getPool().connect());
  try {
    await client.query("SELECT pg_advisory_lock(727001)");
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         id text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const done = new Set(
      (await client.query<{ id: string }>("SELECT id FROM schema_migrations")).rows.map((r) => r.id),
    );
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [m.id]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
    if (own) await own.end();
    else (client as pg.PoolClient).release();
  }
}
