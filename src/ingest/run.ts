import { ensureSchema, query } from "../db.js";
import { redact } from "../lib/util.js";
import { ingestHygiene } from "./hygiene.js";
import { ingestPrices } from "./prices.js";

export type Job = "hygiene" | "prices";

export async function runJob(job: Job, trigger: string, opts: { budgetMs?: number } = {}) {
  await ensureSchema();
  const [run] = await query<{ id: number }>(
    `INSERT INTO ingest_runs (job, trigger) VALUES ($1, $2) RETURNING id`,
    [job, trigger],
  );
  try {
    const result = job === "hygiene" ? await ingestHygiene(opts) : await ingestPrices(opts);
    await query(
      `UPDATE ingest_runs SET finished_at = now(), status = $2, rows = $3, message = $4 WHERE id = $1`,
      [run.id, result.partial ? "partial" : "ok", result.rows, redact(result.message).slice(0, 2000)],
    );
    return { id: run.id, status: result.partial ? "partial" : "ok", ...result };
  } catch (err) {
    const message = redact(`${(err as any)?.code ?? ""} ${(err as Error)?.message ?? String(err)}`.trim());
    await query(`UPDATE ingest_runs SET finished_at = now(), status = 'error', message = $2 WHERE id = $1`, [
      run.id,
      message.slice(0, 2000),
    ]);
    return { id: run.id, status: "error", rows: 0, message };
  }
}
