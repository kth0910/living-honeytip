export const CSS = /* css */ `
:root {
  --bg: #f6f6f3;
  --surface: #ffffff;
  --surface-2: #f0f0ec;
  --text: #17191c;
  --muted: #62676d;
  --faint: #8b9096;
  --line: #e3e3de;
  --brand: #0d6e63;
  --brand-ink: #ffffff;
  --brand-soft: #e3f2ef;
  --focus: #1b74e4;
  --up: #d0283b;      /* 가격 상승: 빨강 (국내 관례) */
  --up-soft: #fdebed;
  --down: #1d63c9;    /* 가격 하락: 파랑 */
  --down-soft: #e8f0fc;
  --sev3: #b3162b;
  --sev3-soft: #fde8ea;
  --sev2: #a34a00;
  --sev2-soft: #fff1e0;
  --sev1: #4a5059;
  --sev1-soft: #eef0f2;
  --ok: #157347;
  --ok-soft: #e4f4ea;
  --shadow: 0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.04);
  --radius: 14px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #111315; --surface: #1a1d20; --surface-2: #23272b; --text: #eceef0; --muted: #a3a9b0; --faint: #7d848c;
    --line: #2e3337; --brand: #3fb8a6; --brand-ink: #06221e; --brand-soft: #173430; --focus: #6aa8ff;
    --up: #ff6b7a; --up-soft: #3a1c21; --down: #6ea8ff; --down-soft: #182a44;
    --sev3: #ff7a88; --sev3-soft: #3d1a20; --sev2: #ffb066; --sev2-soft: #3a2914; --sev1: #b9c0c8; --sev1-soft: #2a2f34;
    --ok: #5fd08f; --ok-soft: #173225; --shadow: none; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #111315; --surface: #1a1d20; --surface-2: #23272b; --text: #eceef0; --muted: #a3a9b0; --faint: #7d848c;
  --line: #2e3337; --brand: #3fb8a6; --brand-ink: #06221e; --brand-soft: #173430; --focus: #6aa8ff;
  --up: #ff6b7a; --up-soft: #3a1c21; --down: #6ea8ff; --down-soft: #182a44;
  --sev3: #ff7a88; --sev3-soft: #3d1a20; --sev2: #ffb066; --sev2-soft: #3a2914; --sev1: #b9c0c8; --sev1-soft: #2a2f34;
  --ok: #5fd08f; --ok-soft: #173225; --shadow: none; color-scheme: dark;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.55 system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
  word-break: keep-all; overflow-wrap: anywhere;
}
a { color: inherit; }
img, svg { max-width: 100%; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 6px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skip { position: absolute; left: -999px; top: 8px; background: var(--surface); padding: 8px 12px; border-radius: 8px; z-index: 50; }
.skip:focus { left: 8px; }

.wrap { max-width: 880px; margin: 0 auto; padding: 0 16px; }

/* header */
.top { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px); border-bottom: 1px solid var(--line); }
.top .wrap { display: flex; align-items: center; gap: 12px; min-height: 56px; }
.brand { display: flex; align-items: center; gap: 8px; text-decoration: none; font-weight: 800; letter-spacing: -0.02em; font-size: 18px; white-space: nowrap; }
.brand .logo { width: 28px; height: 28px; border-radius: 8px; background: var(--brand); color: var(--brand-ink); display: grid; place-items: center; font-size: 15px; }
.tabs { display: flex; gap: 4px; margin-left: auto; }
.tabs a { text-decoration: none; padding: 8px 12px; border-radius: 999px; color: var(--muted); font-weight: 600; font-size: 15px; white-space: nowrap; }
.tabs a[aria-current="page"] { background: var(--text); color: var(--bg); }
.tabs a:not([aria-current="page"]):hover { background: var(--surface-2); color: var(--text); }
@media (max-width: 520px) {
  .brand .name { display: none; }
  .tabs a { padding: 8px 10px; font-size: 14.5px; }
}

main { padding: 20px 0 48px; }
h1 { font-size: clamp(24px, 5.2vw, 30px); line-height: 1.25; letter-spacing: -0.03em; margin: 8px 0 6px; }
h2 { font-size: 19px; letter-spacing: -0.02em; margin: 28px 0 10px; line-height: 1.35; }
h3 { font-size: 16px; margin: 0; }
p { margin: 0 0 8px; }
.lead { color: var(--muted); margin-bottom: 16px; }
.muted { color: var(--muted); }
.faint { color: var(--faint); }
.small { font-size: 14px; }
.tiny { font-size: 12.5px; }
.num { font-variant-numeric: tabular-nums; }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spacer { flex: 1; }
.stack > * + * { margin-top: 10px; }

.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
.pad { padding: 16px; }
.list { list-style: none; margin: 0; padding: 0; }

/* forms */
.search { display: grid; gap: 10px; }
.field { position: relative; }
.field svg { position: absolute; left: 14px; top: 50%; translate: 0 -50%; color: var(--faint); pointer-events: none; }
input[type="search"], input[type="text"], select {
  font: inherit; color: inherit; background: var(--surface); border: 1.5px solid var(--line); border-radius: 12px;
  min-height: 48px; padding: 10px 14px; width: 100%;
}
input[type="search"] { padding-left: 44px; font-size: 17px; }
input:focus, select:focus { border-color: var(--brand); outline: none; box-shadow: 0 0 0 3px var(--brand-soft); }
.filters { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.filters > select:first-child { grid-column: 1 / -1; }
@media (min-width: 640px) { .filters { grid-template-columns: 1.4fr 1fr 1fr auto; } .filters > select:first-child { grid-column: auto; } }
.btn { font: inherit; font-weight: 700; border: 0; border-radius: 12px; min-height: 48px; padding: 10px 18px; cursor: pointer;
  background: var(--brand); color: var(--brand-ink); text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.btn.ghost { background: var(--surface-2); color: var(--text); }
.btn.block { width: 100%; }
.filters .btn { grid-column: 1 / -1; }
@media (min-width: 640px) { .filters .btn { grid-column: auto; } }

/* chips & badges */
.chips { display: flex; gap: 6px; overflow-x: auto; padding: 2px 0 6px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.chips::-webkit-scrollbar { display: none; }
.chip { flex: none; font: inherit; font-size: 14.5px; font-weight: 600; border: 1.5px solid var(--line); background: var(--surface);
  color: var(--muted); border-radius: 999px; padding: 6px 13px; cursor: pointer; text-decoration: none; white-space: nowrap; min-height: 36px; }
.chip[aria-pressed="true"], .chip[aria-current="true"] { background: var(--text); color: var(--bg); border-color: var(--text); }
.badge { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; padding: 3px 9px; border-radius: 999px; white-space: nowrap; line-height: 1.4; }
.sev3 { background: var(--sev3-soft); color: var(--sev3); }
.sev2 { background: var(--sev2-soft); color: var(--sev2); }
.sev1 { background: var(--sev1-soft); color: var(--sev1); }
.tag { font-size: 13px; color: var(--muted); background: var(--surface-2); border-radius: 6px; padding: 2px 8px; white-space: nowrap; }
.up { color: var(--up); }
.down { color: var(--down); }
.flat { color: var(--muted); }
.pill-up { background: var(--up-soft); color: var(--up); }
.pill-down { background: var(--down-soft); color: var(--down); }
.pill-flat { background: var(--surface-2); color: var(--muted); }
.pill-ok { background: var(--ok-soft); color: var(--ok); }

/* home */
.hero-grid { display: grid; gap: 12px; margin-top: 14px; }
@media (min-width: 680px) { .hero-grid { grid-template-columns: 1fr 1fr; } }
.feature { display: block; text-decoration: none; padding: 18px; position: relative; overflow: hidden; }
.feature .icon { width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; font-size: 22px; margin-bottom: 12px; }
.feature h2 { margin: 0 0 4px; font-size: 20px; }
.feature .go { font-weight: 700; color: var(--brand); margin-top: 10px; display: inline-block; }
.feature:hover { border-color: var(--brand); }

/* hygiene result */
.biz { display: block; text-decoration: none; padding: 14px 16px; }
.biz + .biz { border-top: 1px solid var(--line); }
.biz:hover { background: var(--surface-2); }
.biz .name { font-weight: 800; font-size: 17px; letter-spacing: -0.01em; }
.biz .addr { color: var(--muted); font-size: 14px; margin-top: 2px; }
.biz .meta { margin-top: 8px; }
.biz .when { font-size: 14px; color: var(--muted); }
.biz .viol { font-size: 14.5px; margin-top: 6px; color: var(--text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.stat { padding: 12px; border-radius: 12px; background: var(--surface-2); }
.stat .v { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.stat .k { font-size: 13px; color: var(--muted); }

.timeline { list-style: none; margin: 0; padding: 0; position: relative; }
.timeline li { position: relative; padding: 0 0 18px 26px; }
.timeline li::before { content: ""; position: absolute; left: 7px; top: 22px; bottom: 0; width: 2px; background: var(--line); }
.timeline li:last-child::before { display: none; }
.timeline .dot { position: absolute; left: 0; top: 5px; width: 16px; height: 16px; border-radius: 50%; border: 3px solid var(--surface); box-shadow: 0 0 0 2px var(--line); }
.dot.s3 { background: var(--sev3); } .dot.s2 { background: var(--sev2); } .dot.s1 { background: var(--faint); }

.callout { border-radius: 12px; padding: 12px 14px; background: var(--brand-soft); font-size: 14.5px; }
.callout.warn { background: var(--sev2-soft); }
.callout.good { background: var(--ok-soft); }
details.help { font-size: 14.5px; }
details.help summary { cursor: pointer; color: var(--muted); font-weight: 600; list-style: none; }
details.help summary::-webkit-details-marker { display: none; }
details.help summary::before { content: "ⓘ "; }
details.help[open] summary { margin-bottom: 8px; }

/* prices */
.picks { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(150px, 1fr); gap: 10px; overflow-x: auto; padding-bottom: 6px;
  scroll-snap-type: x mandatory; scrollbar-width: thin; }
.pick { scroll-snap-align: start; padding: 14px; text-decoration: none; display: flex; flex-direction: column; gap: 2px; min-height: 120px; }
.pick .nm { font-weight: 800; }
.pick .u { font-size: 13px; color: var(--faint); }
.pick .pr { font-weight: 800; font-size: 18px; margin-top: auto; }
.pick:hover { border-color: var(--brand); }

.toolbar { display: grid; gap: 8px; position: sticky; top: 57px; z-index: 5; background: var(--bg); padding: 8px 0 4px; }
.toolbar .two { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.toolbar select { min-height: 44px; width: auto; }
.toolbar input[type="search"] { min-height: 44px; font-size: 16px; }

.plist { list-style: none; margin: 0; padding: 0; }
.prow { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 12px 16px; text-decoration: none; align-items: center; }
.plist li + li .prow { border-top: 1px solid var(--line); }
.prow:hover { background: var(--surface-2); }
.prow .nm { font-weight: 700; }
.prow .u { font-size: 13px; color: var(--faint); }
.prow .pr { text-align: right; font-weight: 800; font-size: 17px; }
.prow .ch { text-align: right; font-size: 14px; font-weight: 700; white-space: nowrap; }
.prow .sub { font-size: 13px; color: var(--muted); }
.cat-head { padding: 10px 16px 6px; font-size: 13px; font-weight: 800; color: var(--muted); background: var(--surface-2); letter-spacing: .02em; }

.bigprice { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
.cmp { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
@media (min-width: 640px) { .cmp { grid-template-columns: repeat(4, 1fr); } }
.cmp .box { padding: 12px; border-radius: 12px; background: var(--surface-2); }
.cmp .k { font-size: 13px; color: var(--muted); }
.cmp .v { font-weight: 800; font-size: 17px; }
.cmp .d { font-size: 13.5px; font-weight: 700; }
.chart { width: 100%; height: auto; display: block; }
.chart text { font-size: 11px; fill: var(--muted); }
.chart { max-height: 260px; }

.table { width: 100%; border-collapse: collapse; font-size: 15px; }
.table th, .table td { padding: 9px 4px; border-bottom: 1px solid var(--line); text-align: left; }
.table td.r, .table th.r { text-align: right; }

.empty { text-align: center; padding: 32px 16px; }
.empty .big { font-size: 40px; }
.pager { display: flex; justify-content: center; gap: 8px; margin-top: 14px; }

footer { border-top: 1px solid var(--line); padding: 20px 0 40px; color: var(--muted); font-size: 13.5px; }
footer a { color: var(--muted); }
.hidden { display: none !important; }
`;
