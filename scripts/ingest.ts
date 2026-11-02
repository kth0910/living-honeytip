// Usage: npm run ingest -- prices|hygiene [budgetMs]
import { existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);
const { runJob } = await import("../src/ingest/run.js");
const { getPool } = await import("../src/db.js");
const job = process.argv[2];
if (job !== "prices" && job !== "hygiene") {
  console.error("usage: npm run ingest -- prices|hygiene [budgetMs]");
  process.exit(2);
}
const result = await runJob(job, "cli", { budgetMs: Number(process.argv[3]) || undefined });
console.log(JSON.stringify(result, null, 2));
await getPool().end();
process.exit(result.status === "error" ? 1 : 0);
