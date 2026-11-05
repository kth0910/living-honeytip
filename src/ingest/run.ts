import { ensureSchema, query } from "../db.js";
import { redact } from "../lib/util.js";
import { ingestHygiene } from "./hygiene.js";
import { ingestPrices } from "./prices.js";
import { ingestGrades } from "./grades.js";
import { ingestBenefits } from "./benefits.js";
import { ingestGoods } from "./goods.js";

export type Job = "hygiene" | "prices" | "grades" | "benefits" | "goods";

export async function runJob(job: Job, trigger: string, opts: { budgetMs?: number } = {}) {
  await ensureSchema();
  // 같은 작업이 이미 돌고 있으면 겹쳐 돌지 않는다 (호출 제한을 아끼려고).
  // 오래 멈춘 'running' 기록은 15분이 지나면 무시한다.
  const [run] = await query<{ id: number }>(
    `INSERT INTO ingest_runs (job, trigger)
     SELECT $1, $2
     WHERE NOT EXISTS (
       SELECT 1 FROM ingest_runs WHERE job = $1 AND status = 'running' AND started_at > now() - interval '15 minutes'
     )
     RETURNING id`,
    [job, trigger],
  );
  if (!run) return { id: null, status: "skipped", rows: 0, message: "이미 받는 중이라 건너뜀" };
  try {
    const result =
      job === "hygiene"
        ? await ingestHygiene(opts)
        : job === "grades"
          ? await ingestGrades(opts)
          : job === "benefits"
            ? await ingestBenefits(opts)
            : job === "goods"
              ? await ingestGoods(opts)
              : await ingestPrices(opts);
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
