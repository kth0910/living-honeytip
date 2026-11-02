import { existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);
const { ensureSchema, getPool } = await import("../src/db.js");
// Migrations use the direct (unpooled) connection when available.
await ensureSchema(process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL);
console.log("migrations applied");
await getPool().end().catch(() => {});
