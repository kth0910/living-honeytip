// assets/ 폴더의 디자인 시스템(CSS), 로고, 아이콘 SVG를 앱 코드에서 쓸 수 있게 하나의 모듈로 만든다.
// 함수 배포 번들은 TypeScript 소스만 묶으므로, 에셋은 이 생성 파일을 통해 함께 배포된다.
//   node scripts/gen-assets.mjs   (npm run build 때 자동 실행)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), "utf8").trim();

const icons = {};
for (const file of readdirSync(join(root, "assets/icons")).sort()) {
  if (!file.endsWith(".svg")) continue;
  const svg = read(`assets/icons/${file}`);
  const m = svg.match(/^<svg[^>]*?(\sfill="[^"]*")?[^>]*>([\s\S]*)<\/svg>$/);
  if (!m) throw new Error(`unexpected svg: ${file}`);
  const filled = /fill="currentColor"/.test(svg.slice(0, svg.indexOf(">")));
  icons[file.replace(/\.svg$/, "")] = { body: m[2].trim(), filled };
}

const out = `// 자동 생성 파일: scripts/gen-assets.mjs 가 assets/ 에서 만든다. 직접 고치지 말 것.
export const DESIGN_SYSTEM_CSS = ${JSON.stringify(read("assets/design-system.css"))};
export const LOGO_MARK_SVG = ${JSON.stringify(read("assets/brand/logo-mark.svg"))};
export const FAVICON_SVG = ${JSON.stringify(read("assets/brand/favicon.svg"))};
export const ICONS: Record<string, { body: string; filled: boolean }> = ${JSON.stringify(icons, null, 2)};
`;
writeFileSync(join(root, "src/assets.generated.ts"), out);
console.log(`assets: ${Object.keys(icons).length} icons, css ${(read("assets/design-system.css").length / 1024).toFixed(1)} KiB`);
