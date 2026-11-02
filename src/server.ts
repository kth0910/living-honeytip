// Local runner: `npm start` serves the same Hono app with Node.
import { existsSync } from "node:fs";
for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

const { serve } = await import("@hono/node-server");
const { default: app } = await import("./app.js");

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`동네살림 listening on http://localhost:${info.port}`);
});
