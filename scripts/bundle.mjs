// Verifies the function entry bundles into a single ESM file (what `neon deploy` uploads).
import { build } from "esbuild";
const result = await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outfile: "dist/index.mjs",
  jsx: "automatic",
  jsxImportSource: "hono/jsx",
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  metafile: true,
  logLevel: "warning",
});
const bytes = Object.values(result.metafile.outputs).reduce((n, o) => n + o.bytes, 0);
console.log(`bundle ok: dist/index.mjs (${(bytes / 1024).toFixed(0)} KiB)`);
