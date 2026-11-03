// 자동 생성 파일: scripts/gen-assets.mjs 가 assets/ 에서 만든다. 직접 고치지 말 것.
export const DESIGN_SYSTEM_CSS = "/* 동네살림 디자인 시스템\n   원칙: 회색 바탕 위 흰 카드, 큰 굵은 제목, 넉넉한 여백, 한 가지 브랜드 색, 기호 대신 아이콘. */\n\n:root {\n  /* 색 */\n  --brand: #12a36e;\n  --brand-strong: #0b8a5c;\n  --brand-weak: #e6f6ef;\n  --light: #ffd54a;\n  --bg: #f2f4f6;\n  --surface: #ffffff;\n  --surface-2: #f7f8fa;\n  --fill: #f2f4f6;\n  --line: #e5e8eb;\n  --text: #191f28;\n  --text-2: #4e5968;\n  --text-3: #8b95a1;\n  --text-4: #b0b8c1;\n  --up: #f04452;\n  --up-weak: #fdeced;\n  --down: #3182f6;\n  --down-weak: #e8f3ff;\n  --danger: #e42939;\n  --danger-weak: #ffeeee;\n  --warn: #e07b00;\n  --warn-weak: #fff3e0;\n  --good: #0b8a5c;\n  --good-weak: #e6f6ef;\n  --focus: #3182f6;\n  /* 모양 */\n  --r-sm: 10px;\n  --r-md: 14px;\n  --r-lg: 20px;\n  --shadow: 0 1px 2px rgba(0, 0, 0, 0.03);\n  --tabbar-h: 64px;\n  color-scheme: light;\n}\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme=\"light\"]) {\n    --brand: #2bc48a; --brand-strong: #4fd6a2; --brand-weak: #133528;\n    --bg: #101214; --surface: #1b1e22; --surface-2: #22262b; --fill: #2a2e34; --line: #2f343a;\n    --text: #f2f4f6; --text-2: #c3c9d0; --text-3: #8b95a1; --text-4: #5d6670;\n    --up: #ff6b78; --up-weak: #3a1d21; --down: #5aa0ff; --down-weak: #172a45;\n    --danger: #ff6b78; --danger-weak: #3a1d21; --warn: #ffab4a; --warn-weak: #3a2a14;\n    --good: #4fd6a2; --good-weak: #133528; --focus: #5aa0ff; --shadow: none; color-scheme: dark;\n  }\n}\n:root[data-theme=\"dark\"] {\n  --brand: #2bc48a; --brand-strong: #4fd6a2; --brand-weak: #133528;\n  --bg: #101214; --surface: #1b1e22; --surface-2: #22262b; --fill: #2a2e34; --line: #2f343a;\n  --text: #f2f4f6; --text-2: #c3c9d0; --text-3: #8b95a1; --text-4: #5d6670;\n  --up: #ff6b78; --up-weak: #3a1d21; --down: #5aa0ff; --down-weak: #172a45;\n  --danger: #ff6b78; --danger-weak: #3a1d21; --warn: #ffab4a; --warn-weak: #3a2a14;\n  --good: #4fd6a2; --good-weak: #133528; --focus: #5aa0ff; --shadow: none; color-scheme: dark;\n}\n\n*, *::before, *::after { box-sizing: border-box; }\nhtml { -webkit-text-size-adjust: 100%; }\nbody {\n  margin: 0;\n  background: var(--bg);\n  color: var(--text);\n  font: 16px/1.55 \"Pretendard Variable\", Pretendard, -apple-system, BlinkMacSystemFont, \"Apple SD Gothic Neo\", \"Malgun Gothic\", system-ui, sans-serif;\n  letter-spacing: -0.01em;\n  word-break: keep-all;\n  overflow-wrap: anywhere;\n  -webkit-font-smoothing: antialiased;\n}\na { color: inherit; text-decoration: none; }\nbutton { font: inherit; }\n:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; border-radius: 8px; }\n.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }\n.skip { position: absolute; left: -999px; top: 8px; background: var(--surface); padding: 10px 14px; border-radius: 10px; z-index: 50; }\n.skip:focus { left: 8px; }\n.ico { width: 1em; height: 1em; flex: none; display: inline-block; vertical-align: -0.125em; }\n.num { font-variant-numeric: tabular-nums; }\n.hidden { display: none !important; }\n\n/* 레이아웃 */\n.wrap { max-width: 720px; margin: 0 auto; padding: 0 16px; }\nmain { padding: 8px 0 calc(var(--tabbar-h) + 32px); }\n@media (min-width: 840px) { main { padding-bottom: 56px; } }\n\n/* 상단 바 */\n.appbar { position: sticky; top: 0; z-index: 20; background: var(--bg); }\n.appbar .wrap { display: flex; align-items: center; gap: 12px; height: 56px; }\n.brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; font-size: 19px; letter-spacing: -0.03em; }\n.brand img { width: 28px; height: 28px; display: block; }\n.topnav { display: none; margin-left: auto; gap: 4px; }\n.topnav a { padding: 8px 14px; border-radius: 999px; font-weight: 600; color: var(--text-2); }\n.topnav a:hover { background: var(--fill); color: var(--text); }\n.topnav a[aria-current=\"page\"] { color: var(--text); background: var(--surface); }\n@media (min-width: 840px) { .topnav { display: flex; } }\n\n/* 하단 탭바 (모바일) */\n.tabbar {\n  position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;\n  background: var(--surface); border-top: 1px solid var(--line);\n  padding-bottom: env(safe-area-inset-bottom);\n}\n.tabbar ul { list-style: none; margin: 0 auto; padding: 0; max-width: 720px; display: grid; grid-template-columns: repeat(3, 1fr); height: var(--tabbar-h); }\n.tabbar a { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--text-3); }\n.tabbar a .ico { font-size: 24px; }\n.tabbar a[aria-current=\"page\"] { color: var(--text); }\n@media (min-width: 840px) { .tabbar { display: none; } }\n\n/* 글자 */\n.page-title { font-size: 26px; line-height: 1.3; font-weight: 800; letter-spacing: -0.035em; margin: 12px 0 6px; }\n.page-sub { color: var(--text-2); font-size: 16px; margin: 0 0 20px; }\n.section-title { font-size: 20px; font-weight: 800; letter-spacing: -0.03em; margin: 0; }\n.section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }\n.section-head .more { font-size: 14px; font-weight: 600; color: var(--text-3); display: inline-flex; align-items: center; gap: 2px; }\n.t2 { color: var(--text-2); }\n.t3 { color: var(--text-3); }\n.small { font-size: 14px; }\n.tiny { font-size: 13px; }\n.strong { font-weight: 700; }\np { margin: 0; }\n.stack > * + * { margin-top: 8px; }\n\n/* 카드 */\n.card { background: var(--surface); border-radius: var(--r-lg); padding: 20px; box-shadow: var(--shadow); margin-top: 12px; }\n.card.flush { padding: 8px 0; }\n.card.flush > .section-head { padding: 12px 20px 0; }\n\n/* 목록 줄 */\n.rows { list-style: none; margin: 0; padding: 0; }\n.row { display: flex; align-items: center; gap: 14px; padding: 14px 20px; min-height: 64px; }\na.row:active, a.row:hover { background: var(--surface-2); }\n.row .main { flex: 1; min-width: 0; }\n.row .title { font-size: 17px; font-weight: 700; line-height: 1.4; }\n.row .sub { font-size: 14px; color: var(--text-3); margin-top: 2px; }\n.row .end { text-align: right; flex: none; }\n.row .value { font-size: 17px; font-weight: 700; }\n.row .chev { color: var(--text-4); font-size: 20px; }\n.row-head { padding: 18px 20px 6px; font-size: 14px; font-weight: 700; color: var(--text-3); }\n.divider { height: 8px; background: var(--bg); margin: 8px 0; }\n\n/* 아이콘 타일 */\n.tile { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; flex: none; font-size: 24px; }\n.tile.green { background: var(--brand-weak); color: var(--brand); }\n.tile.red { background: var(--danger-weak); color: var(--danger); }\n.tile.orange { background: var(--warn-weak); color: var(--warn); }\n.tile.blue { background: var(--down-weak); color: var(--down); }\n.tile.gray { background: var(--fill); color: var(--text-3); }\n\n/* 입력 */\n.search { display: flex; align-items: center; gap: 10px; background: var(--surface); border-radius: var(--r-md); padding: 0 16px; height: 52px; box-shadow: var(--shadow); }\n.search .ico { font-size: 22px; color: var(--text-3); }\n.search input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 17px; color: var(--text); height: 100%; outline: none; }\n.search input::placeholder { color: var(--text-4); }\n.search:focus-within { box-shadow: 0 0 0 2px var(--brand); }\n.select { position: relative; display: block; }\n.select select {\n  appearance: none; -webkit-appearance: none; width: 100%; height: 48px; border: 0; border-radius: var(--r-md);\n  background: var(--fill); color: var(--text); font: inherit; font-weight: 600; padding: 0 44px 0 16px;\n}\n.card .select select { background: var(--fill); }\n.select .ico { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); font-size: 20px; color: var(--text-3); pointer-events: none; }\n.select select:focus { outline: none; box-shadow: 0 0 0 2px var(--brand); }\n\n/* 칩 */\n.chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 2px 0; -webkit-overflow-scrolling: touch; }\n.chips::-webkit-scrollbar { display: none; }\n.chip {\n  flex: none; display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border-radius: 999px;\n  background: var(--fill); color: var(--text-2); font-size: 15px; font-weight: 600; white-space: nowrap; border: 0; cursor: pointer;\n}\n.chip[aria-pressed=\"true\"], .chip[aria-current=\"true\"] { background: var(--text); color: var(--surface); }\n.filter-group + .filter-group { margin-top: 12px; }\n.filter-label { font-size: 13px; font-weight: 700; color: var(--text-3); margin-bottom: 8px; }\n\n/* 버튼 */\n.btn {\n  display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 52px; padding: 0 20px;\n  border-radius: var(--r-md); border: 0; background: var(--brand); color: #fff; font-size: 17px; font-weight: 700; cursor: pointer;\n}\n.btn:hover { background: var(--brand-strong); }\n.btn.block { width: 100%; }\n.btn.secondary { background: var(--fill); color: var(--text); }\n.btn.secondary:hover { background: var(--line); }\n.btn.small { height: 40px; font-size: 15px; padding: 0 14px; border-radius: 12px; }\n.btn .ico { font-size: 18px; }\n.btn-row { display: flex; gap: 8px; }\n.btn-row > * { flex: 1; }\n\n/* 라벨 */\n.label { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border-radius: 6px; font-size: 13px; font-weight: 700; white-space: nowrap; }\n.label .ico { font-size: 14px; }\n.label.sev3 { background: var(--danger-weak); color: var(--danger); }\n.label.sev2 { background: var(--warn-weak); color: var(--warn); }\n.label.sev1 { background: var(--fill); color: var(--text-2); }\n.label.sev0 { background: var(--fill); color: var(--text-3); }\n.label.good { background: var(--good-weak); color: var(--good); }\n.label.up { background: var(--up-weak); color: var(--up); }\n.label.down { background: var(--down-weak); color: var(--down); }\n.label.flat { background: var(--fill); color: var(--text-3); }\n.label.plain { background: var(--fill); color: var(--text-2); font-weight: 600; }\n.labels { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }\n.label.clip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; display: inline-block; line-height: 24px; }\n.tone-good { color: var(--good); }\n.tone-up { color: var(--up); }\n.tone-flat { color: var(--text-3); }\n\n/* 등락 */\n.move { display: inline-flex; align-items: center; gap: 2px; font-weight: 700; font-size: 14px; white-space: nowrap; }\n.move .ico { font-size: 12px; }\n.move.up { color: var(--up); }\n.move.down { color: var(--down); }\n.move.flat { color: var(--text-3); font-weight: 600; }\n\n/* 숫자 카드 */\n.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }\n.stat { background: var(--surface-2); border-radius: var(--r-md); padding: 14px; }\n.stat .v { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }\n.stat .k { font-size: 13px; color: var(--text-3); margin-top: 2px; line-height: 1.35; }\n\n/* 안내 상자 */\n.notice { display: flex; gap: 10px; align-items: flex-start; background: var(--surface-2); border-radius: var(--r-md); padding: 14px 16px; font-size: 15px; color: var(--text-2); }\n.notice .ico { font-size: 20px; margin-top: 1px; color: var(--text-3); }\n.notice.good { background: var(--good-weak); color: var(--good); }\n.notice.good .ico { color: var(--good); }\n.notice.warn { background: var(--warn-weak); color: var(--text); }\n.notice.warn .ico { color: var(--warn); }\n.notice a { text-decoration: underline; text-underline-offset: 3px; }\n\n/* 가로 카드 */\n.hscroll { display: grid; grid-auto-flow: column; grid-auto-columns: 148px; gap: 10px; overflow-x: auto; scrollbar-width: none; margin: 0 -20px; padding: 0 20px 4px; scroll-snap-type: x mandatory; }\n.hscroll::-webkit-scrollbar { display: none; }\n.mini { scroll-snap-align: start; background: var(--surface-2); border-radius: var(--r-md); padding: 14px; display: flex; flex-direction: column; min-height: 132px; }\n.mini .name { font-weight: 700; font-size: 16px; }\n.mini .unit { font-size: 13px; color: var(--text-3); }\n.mini .price { margin-top: auto; font-weight: 800; font-size: 18px; }\n\n/* 빈 상태 */\n.empty { text-align: center; padding: 36px 16px; }\n.empty .tile { margin: 0 auto 14px; width: 56px; height: 56px; border-radius: 18px; font-size: 28px; }\n.empty h2 { font-size: 18px; font-weight: 800; margin: 0 0 6px; }\n.empty p { color: var(--text-2); font-size: 15px; }\n.empty p + p { margin-top: 6px; }\n.empty a { color: var(--brand); font-weight: 700; }\n\n/* 큰 가격 */\n.big { font-size: 34px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.15; }\n\n/* 그래프 */\n.chart { width: 100%; height: auto; display: block; }\n.chart text { font-size: 11px; fill: var(--text-3); font-family: inherit; }\n\n/* 처분 기록 */\n.history { list-style: none; margin: 0; padding: 0; }\n.history li { padding: 16px 20px; }\n.history li + li { border-top: 1px solid var(--line); }\n.history .when { display: flex; align-items: center; justify-content: space-between; gap: 8px; }\n.history .date { font-weight: 800; font-size: 17px; }\n.history .period { font-size: 14px; color: var(--text-2); margin-top: 6px; }\n.history .what { margin-top: 8px; font-size: 16px; line-height: 1.6; }\n.history .law { margin-top: 6px; font-size: 13px; color: var(--text-3); }\n\n/* 페이지 이동 */\n.pager { display: flex; justify-content: center; align-items: center; gap: 8px; padding: 12px 0 4px; }\n\n/* 접기 */\ndetails.more-info summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; }\ndetails.more-info summary::-webkit-details-marker { display: none; }\ndetails.more-info summary .ico:last-child { margin-left: auto; color: var(--text-3); transition: transform 0.15s; }\ndetails.more-info[open] summary .ico:last-child { transform: rotate(180deg); }\ndetails.more-info .body { margin-top: 14px; }\n\n/* 바닥글 */\nfooter { color: var(--text-3); font-size: 13px; padding: 24px 0 calc(var(--tabbar-h) + 24px); line-height: 1.6; }\nfooter a { text-decoration: underline; text-underline-offset: 3px; }\n@media (min-width: 840px) { footer { padding-bottom: 40px; } }\n\n/* 표 */\n.kv { list-style: none; margin: 0; padding: 0; }\n.kv li { display: flex; justify-content: space-between; gap: 12px; padding: 12px 0; }\n.kv li + li { border-top: 1px solid var(--line); }\n.kv .k { color: var(--text-2); }\n.kv .v { font-weight: 700; text-align: right; }\n\n/* 도구 막대 (가격 목록) */\n.toolbar { position: sticky; top: 56px; z-index: 5; background: var(--surface); padding: 12px 20px; border-bottom: 1px solid var(--line); }\n.toolbar .search { background: var(--fill); box-shadow: none; height: 46px; }\n.toolbar .select select { height: 46px; }\n.toolbar .two { display: grid; grid-template-columns: 1fr 132px; gap: 8px; margin-top: 10px; }";
export const LOGO_MARK_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"동네살림\">\n  <rect width=\"48\" height=\"48\" rx=\"14\" fill=\"#12A36E\"/>\n  <path d=\"M10.5 23.5 24 11l13.5 12.5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <path d=\"M15 22.5V34a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V22.5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <circle cx=\"24\" cy=\"29\" r=\"3.2\" fill=\"#FFD54A\"/>\n</svg>";
export const FAVICON_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\" role=\"img\" aria-label=\"동네살림\">\n  <rect width=\"48\" height=\"48\" rx=\"14\" fill=\"#12A36E\"/>\n  <path d=\"M10.5 23.5 24 11l13.5 12.5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <path d=\"M15 22.5V34a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V22.5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"4.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <circle cx=\"24\" cy=\"29\" r=\"3.2\" fill=\"#FFD54A\"/>\n</svg>";
export const ICONS: Record<string, { body: string; filled: boolean }> = {
  "alert": {
    "body": "<path d=\"M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z\"/><path d=\"M12 9.5v4.5\"/><path d=\"M12 17.2h.01\"/>",
    "filled": false
  },
  "archive": {
    "body": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"5\" rx=\"1.5\"/><path d=\"M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9\"/><path d=\"M10 13h4\"/>",
    "filled": false
  },
  "basket": {
    "body": "<path d=\"M3 10h18l-1.7 8.4A2 2 0 0 1 17.3 20H6.7a2 2 0 0 1-2-1.6Z\"/><path d=\"M8 10l3.5-6\"/><path d=\"M16 10l-3.5-6\"/><path d=\"M9.5 14v2.5\"/><path d=\"M14.5 14v2.5\"/>",
    "filled": false
  },
  "bowl": {
    "body": "<path d=\"M3.5 11.5h17a8.5 8.5 0 0 1-17 0Z\"/><path d=\"M9 3.5l1.5 8\"/><path d=\"M14.5 3.5 13 11.5\"/>",
    "filled": false
  },
  "calendar": {
    "body": "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 10h16\"/><path d=\"M9 3v4\"/><path d=\"M15 3v4\"/>",
    "filled": false
  },
  "caret-down": {
    "body": "<path d=\"M12 17.5 5 7.5h14Z\"/>",
    "filled": true
  },
  "caret-up": {
    "body": "<path d=\"M12 6.5 19 16.5H5Z\"/>",
    "filled": true
  },
  "chevron-down": {
    "body": "<path d=\"m6 9.5 6 6 6-6\"/>",
    "filled": false
  },
  "chevron-left": {
    "body": "<path d=\"m14.5 6-6 6 6 6\"/>",
    "filled": false
  },
  "chevron-right": {
    "body": "<path d=\"m9.5 6 6 6-6 6\"/>",
    "filled": false
  },
  "clock": {
    "body": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
    "filled": false
  },
  "compass": {
    "body": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m15.5 8.5-2 5-5 2 2-5Z\"/>",
    "filled": false
  },
  "doc": {
    "body": "<path d=\"M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z\"/><path d=\"M14 3v5h5\"/><path d=\"M9 13h6\"/><path d=\"M9 17h4\"/>",
    "filled": false
  },
  "external": {
    "body": "<path d=\"M14 4h6v6\"/><path d=\"M20 4 11 13\"/><path d=\"M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10\"/>",
    "filled": false
  },
  "home": {
    "body": "<path d=\"M4 11 12 4l8 7\"/><path d=\"M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9\"/><path d=\"M10 20v-5h4v5\"/>",
    "filled": false
  },
  "info": {
    "body": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5.5\"/><path d=\"M12 7.5h.01\"/>",
    "filled": false
  },
  "pin": {
    "body": "<path d=\"M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z\"/><circle cx=\"12\" cy=\"9.5\" r=\"2.5\"/>",
    "filled": false
  },
  "refresh": {
    "body": "<path d=\"M20 11a8 8 0 1 0-2.3 5.7\"/><path d=\"M20 4v7h-7\"/>",
    "filled": false
  },
  "search": {
    "body": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"m20 20-4.5-4.5\"/>",
    "filled": false
  },
  "shield-check": {
    "body": "<path d=\"M12 3 5 6v5.5c0 4.4 3 8.2 7 9.5 4-1.3 7-5.1 7-9.5V6Z\"/><path d=\"m9 12 2.2 2.2L15.5 10\"/>",
    "filled": false
  },
  "tag": {
    "body": "<path d=\"M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l7.2 7.2a1.5 1.5 0 0 1 0 2.1l-7.4 7.4a1.5 1.5 0 0 1-2.1 0L3.8 13.3a1 1 0 0 1-.3-.7Z\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"/>",
    "filled": false
  },
  "tool": {
    "body": "<path d=\"M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.6-.4-.4-2.6Z\"/>",
    "filled": false
  },
  "trend-down": {
    "body": "<path d=\"m3 7 6.5 6.5 4-4L21 17\"/><path d=\"M21 11.5V17h-5.5\"/>",
    "filled": false
  },
  "trend-up": {
    "body": "<path d=\"m3 17 6.5-6.5 4 4L21 7\"/><path d=\"M21 12.5V7h-5.5\"/>",
    "filled": false
  }
};
