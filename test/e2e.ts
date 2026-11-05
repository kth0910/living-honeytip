// End-to-end test against a real Postgres (TEST_DATABASE_URL) and the mock upstream APIs.
//   TEST_DATABASE_URL=postgres://... npm test
import assert from "node:assert/strict";
import { startMock } from "./mock-apis.js";

const MOCK_PORT = 48711;
const APP_PORT = 48712;
const dbUrl = process.env.TEST_DATABASE_URL;
if (!dbUrl) {
  console.error("TEST_DATABASE_URL is required");
  process.exit(2);
}

Object.assign(process.env, {
  DATABASE_URL: dbUrl,
  FOODSAFETY_API_BASE: `http://127.0.0.1:${MOCK_PORT}`,
  DATAKR_API_BASE: `http://127.0.0.1:${MOCK_PORT}/B552845/perDay`,
  FOODSAFTYKOREA_OPEN_API: "test-food-key",
  DATAKR_API_KEY: "test-datago-key",
  ADMIN_TOKEN: "test-admin-token",
  BENEFITS_API_BASE: `http://127.0.0.1:${MOCK_PORT}/api/gov24/v3`,
  GOODS_API_BASE: `http://127.0.0.1:${MOCK_PORT}/B551919/ProductPriceInfoService`,
});
delete process.env.KAMIS_CERT_KEY;
delete process.env.KAMIS_CERT_ID;

const results: string[] = [];
async function step(name: string, fn: () => Promise<void>) {
  const t = Date.now();
  try {
    await fn();
    results.push(`PASS ${name} (${Date.now() - t}ms)`);
    console.log(`PASS ${name}`);
  } catch (err) {
    results.push(`FAIL ${name}: ${(err as Error).message}`);
    console.error(`FAIL ${name}\n`, err);
    process.exitCode = 1;
  }
}

const mock = await startMock(MOCK_PORT);
const { getPool, query } = await import("../src/db.js");
await getPool().query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
const { runJob } = await import("../src/ingest/run.js");
const { serve } = await import("@hono/node-server");
const { default: app } = await import("../src/app.js");
const server = serve({ fetch: app.fetch, port: APP_PORT });
const base = `http://127.0.0.1:${APP_PORT}`;
const get = async (path: string, init?: RequestInit) => {
  const res = await fetch(base + path, init);
  return { status: res.status, text: await res.text(), headers: res.headers };
};

await step("empty DB renders friendly loading states", async () => {
  const p = await get("/prices");
  assert.equal(p.status, 200);
  assert.match(p.text, /아직 가격 정보를 불러오는 중/);
  const h = await get("/hygiene");
  assert.match(h.text, /아직 위생 정보를 불러오는 중/);
});

await step("hygiene page explains a failing first ingest instead of 'loading'", async () => {
  const saved = process.env.FOODSAFTYKOREA_OPEN_API;
  delete process.env.FOODSAFTYKOREA_OPEN_API;
  const r = await runJob("hygiene", "test");
  process.env.FOODSAFTYKOREA_OPEN_API = saved;
  assert.equal(r.status, "error");
  const h = await get("/hygiene");
  assert.match(h.text, /위생 정보를 아직 받아오지 못했어요/);
  assert.match(h.text, /href="\/prices"/);
});

await step("price ingest (data.go.kr perDay format) → Postgres", async () => {
  const r = await runJob("prices", "test");
  assert.equal(r.status, "ok", JSON.stringify(r));
  const [c] = await query<{ dates: number; national: number; regional: number }>(
    `SELECT count(DISTINCT survey_date)::int AS dates,
            count(*) FILTER (WHERE region_code = '0000')::int AS national,
            count(*) FILTER (WHERE region_code <> '0000')::int AS regional FROM price_daily`,
  );
  assert.ok(c.dates >= 40, `dates=${c.dates}`); // 9주치 평일 + 1년 전 2주
  assert.ok(c.national > 0 && c.regional > 0);
  // 재실행 시 이미 있는 과거 주는 다시 받지 않는다
  const before = (mock as any).calls.length;
  const r2 = await runJob("prices", "test");
  assert.equal(r2.status, "ok");
  const perDayCalls = (mock as any).calls.slice(before).filter((u: string) => u.includes("perDay")).length;
  const { PRICE_ITEMS } = await import("../src/ingest/catalog.js");
  assert.ok(perDayCalls <= PRICE_ITEMS.length, `re-run made ${perDayCalls} calls`); // 품목당 1회(최근 구간)
});

await step("hygiene ingest (I2630 format) → Postgres with region parsing + severity", async () => {
  const r = await runJob("hygiene", "test");
  assert.equal(r.status, "ok", JSON.stringify(r));
  assert.match(r.message, /I2630: INFO-110 사용 불가/); // 신청 안 된 서비스는 건너뜀
  const [c] = await query<{ n: number; regions: number; sev3: number; nosido: number }>(
    `SELECT count(*)::int AS n, count(DISTINCT sigungu)::int AS regions,
            count(*) FILTER (WHERE severity = 3)::int AS sev3,
            count(*) FILTER (WHERE sido IS NULL)::int AS nosido FROM hygiene_actions`,
  );
  assert.ok(c.n > 50, `rows=${c.n}`);
  assert.equal(c.nosido, 0);
  assert.ok(c.regions >= 8);
  assert.ok(c.sev3 > 0);
  // 다시 돌려도 중복이 생기지 않는다
  const r2 = await runJob("hygiene", "test");
  const [c2] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM hygiene_actions`);
  assert.equal(c2.n, c.n);
  assert.equal(r2.rows, 0);
});

await step("hygiene grades ingest (C004) without personal fields, linked to actions by business", async () => {
  const r = await runJob("grades", "test");
  assert.equal(r.status, "ok", JSON.stringify(r));
  const [c] = await query<{ n: number; pii: number; linked: number }>(
    `SELECT count(*)::int AS n,
            count(*) FILTER (WHERE raw ? 'PRSDNT_NM' OR raw ? 'TELNO' OR raw ? 'WRKR_REG_NO')::int AS pii,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM hygiene_actions a WHERE a.biz_key = hygiene_grades.biz_key))::int AS linked
       FROM hygiene_grades`,
  );
  assert.equal(c.n, 6);
  assert.equal(c.pii, 0, "personal fields must not be stored");
  assert.equal(c.linked, 1);
  const again = await runJob("grades", "test"); // 하루 안에 다시 돌면 건너뜀
  assert.equal(again.status, "ok");
});

await step("benefits ingest and pages: region, age, field, detail", async () => {
  const r = await runJob("benefits", "test");
  assert.equal(r.status, "ok", JSON.stringify(r));
  const [c] = await query<{ n: number; local: number }>(`SELECT count(*)::int AS n, count(sido)::int AS local FROM benefits`);
  assert.equal(c.n, 5);
  assert.equal(c.local, 3);
  const all = await get("/benefits");
  assert.equal(all.status, 200);
  assert.match(all.text, /많이 찾는 혜택/);
  assert.match(all.text, /근로, 자녀장려금/); // 원문 가운뎃점은 쉼표로
  // 강남구에 사는 30대: 전국 혜택 + 서울 + 강남구, 마포구 어르신 교통비는 빠짐
  const gn = await get("/benefits?r=" + encodeURIComponent("서울 강남구") + "&age=30");
  assert.match(gn.text, /강남구 출산축하금/);
  assert.match(gn.text, /서울시 청년수당/);
  assert.ok(!gn.text.includes("마포구 어르신 교통비"));
  const list = await get("/benefits?list=local&r=" + encodeURIComponent("서울 강남구"));
  assert.match(list.text, /강남구 출산축하금/);
  assert.ok(!list.text.includes("청년월세 특별지원"), "local list has only local benefits");
  const field = await get("/benefits?list=popular&f=" + encodeURIComponent("주거·자립"));
  assert.match(field.text, /청년월세 특별지원/);
  assert.ok(!field.text.includes("서울시 청년수당"));
  const d = await get("/benefits/100000000001");
  assert.equal(d.status, 200);
  assert.match(d.text, /정부24에서 자세히 보고 신청하기/);
  assert.match(d.text, /19세부터 34세까지/);
  assert.match(d.text, /<ul class="bullets">/);
  assert.equal((await get("/benefits/nope!")).status, 404);
});

await step("goods ingest (XML) and pages: averages, store types, cheapest stores", async () => {
  const r = await runJob("goods", "test");
  assert.equal(r.status, "ok", JSON.stringify(r));
  const [c] = await query<{ days: number; stats: number }>(
    `SELECT count(DISTINCT survey_day)::int AS days, count(*)::int AS stats FROM goods_stats WHERE region = '0000'`,
  );
  assert.equal(c.days, 2);
  assert.equal(c.stats, 4);
  const p = await get("/prices/goods");
  assert.equal(p.status, 200);
  assert.match(p.text, /예시 흰우유\(1L\)/);
  assert.match(p.text, /가게에 따라 평균/);
  assert.match(p.text, /data-price="\d+"/);
  const item = await get("/prices/goods/224");
  assert.equal(item.status, 200);
  assert.match(item.text, /가장 싸게 판 가게/);
  assert.match(item.text, /예시마트 강남점/);
  assert.match(item.text, /대형마트 평균/);
  const seoul = await get("/prices/goods/553?r=" + encodeURIComponent("서울"));
  assert.equal(seoul.status, 200);
  assert.ok(!seoul.text.includes("예시백화점 부산점"), "region filter on stores");
  assert.equal((await get("/prices/goods/abc")).status, 404);
  // 다 받은 뒤 다시 돌리면 호출 없이 끝난다
  const again = await runJob("goods", "test");
  assert.equal(again.status, "ok");
  assert.match(again.message, /모두 받아 둠/);
  // 같은 작업이 돌고 있으면 겹쳐 돌지 않는다
  await query(`INSERT INTO ingest_runs (job, trigger) VALUES ('goods', 'other')`);
  const overlap = await runJob("goods", "test");
  assert.equal(overlap.status, "skipped");
  await query(`DELETE FROM ingest_runs WHERE job = 'goods' AND trigger = 'other'`);
});

await step("bad API keys are reported as errors in ingest_runs (no secrets leaked)", async () => {
  const saved = process.env.DATAKR_API_KEY;
  process.env.DATAKR_API_KEY = "wrong-key-123456";
  const r = await runJob("prices", "test");
  process.env.DATAKR_API_KEY = saved;
  assert.equal(r.status, "error");
  assert.match(r.message, /SERVICE_KEY_IS_NOT_REGISTERED/);
  assert.ok(!r.message.includes("wrong-key-123456"));
});

await step("home page shows price highlights and recent actions", async () => {
  const h = await get("/");
  assert.equal(h.status, 200);
  assert.match(h.text, /이번 주 장바구니/);
  assert.match(h.text, /최근 위생 처분/);
});

await step("hygiene search, filters, region cookie, detail page", async () => {
  const s = await get("/hygiene?q=" + encodeURIComponent("가나다김밥 역삼"));
  assert.equal(s.status, 200);
  assert.match(s.text, /가나다김밥 역삼본점/);
  const key = s.text.match(/\/hygiene\/b\/([0-9a-f]{16})/)![1];
  const d = await get(`/hygiene/b/${key}`);
  assert.equal(d.status, 200);
  assert.match(d.text, /처분 기록/);
  assert.match(d.text, /이물/);
  const none = await get("/hygiene?q=" + encodeURIComponent("존재하지않는가게"));
  assert.match(none.text, /처분 기록이 없어요/);
  const r = await get("/hygiene?r=" + encodeURIComponent("서울 강남구"));
  assert.match(r.text, /서울 강남구 최근 1년 요약/);
  assert.match(r.headers.get("set-cookie") ?? "", /region=/);
  const severe = await get("/hygiene?sev=3&p=all");
  assert.equal(severe.status, 200);
  const cards = severe.text.split('<a class="row" href="/hygiene/b/').slice(1).map((c) => c.split("</a>")[0]);
  assert.ok(cards.length > 0, "expected severe results");
  assert.ok(cards.every((c) => c.includes("label sev3")), "severity filter should only list 영업취소 businesses");
  // 무단멸실(폐업 미신고)은 위생 위반이 아니므로 가장 낮은 단계 + 설명 태그
  const closed = await get("/hygiene?p=all&q=" + encodeURIComponent("예시폐업식당"));
  assert.match(closed.text, /label sev0/);
  assert.match(closed.text, /폐업 정리/);
  // 둘러보기 목록·요약에서는 빠지고, 빠졌다는 안내가 나온다
  const mapo = await get("/hygiene?p=all&r=" + encodeURIComponent("서울 마포구"));
  assert.ok(!mapo.text.includes("예시폐업식당"), "admin closure hidden when browsing");
  assert.match(mapo.text, /서류상 정리된 가게 1곳/);
  const withAdmin = await get("/hygiene?p=all&sev=0&r=" + encodeURIComponent("서울 마포구"));
  assert.match(withAdmin.text, /예시폐업식당/);
  // 동네 둘러보기는 식당·카페만, 이름 검색은 모든 업소
  const browse = await get("/hygiene?r=" + encodeURIComponent("서울 강남구") + "&p=all");
  assert.ok(!browse.text.includes("예시건강식품판매점"), "non-restaurant hidden in default browse");
  const allScope = await get("/hygiene?r=" + encodeURIComponent("서울 강남구") + "&p=all&k=all");
  assert.match(allScope.text, /예시건강식품판매점/);
  const byName = await get("/hygiene?q=" + encodeURIComponent("예시건강식품"));
  assert.match(byName.text, /예시건강식품판매점/);
  // 위생등급 보기: 지금 유효한 곳만(기간 지남, 폐업 제외)
  const gv = await get("/hygiene?v=grade&r=" + encodeURIComponent("서울 강남구"));
  assert.match(gv.text, /예시청결식당 본점/);
  assert.match(gv.text, /가나다김밥 역삼본점/);
  assert.ok(!gv.text.includes("예시만료식당"), "expired grade hidden");
  assert.ok(!gv.text.includes("예시폐업카페"), "closed business hidden");
  assert.match(gv.text, /위생등급 지정/);
  // 처분 보기에서 이름으로 찾으면 위생등급 식당도 함께
  const gs = await get("/hygiene?q=" + encodeURIComponent("예시청결"));
  assert.match(gs.text, /위생등급 받은 곳/);
  assert.match(gs.text, /예시청결카페/);
  // 처분 기록 없이 등급만 있는 가게도 상세 페이지가 열림
  const gkey = gv.text.match(/href="\/hygiene\/b\/([0-9a-f]{16})"[\s\S]{0,200}예시청결식당/)![1];
  const gd = await get(`/hygiene/b/${gkey}`);
  assert.equal(gd.status, 200);
  assert.match(gd.text, /위생등급 식당이에요/);
  assert.match(gd.text, /공개된 위생 처분 기록이 없어요/);
  // 처분도 있고 등급도 있는 가게: 두 정보가 함께
  const both = await get(`/hygiene/b/${key}`);
  assert.match(both.text, /위생등급 식당이에요/);
  assert.match(both.text, /처분 기록/);
  const bad = await get("/hygiene/b/zzzz");
  assert.equal(bad.status, 404);
});

await step("prices page: weekly comparison, picks, item detail, regions", async () => {
  const p = await get("/prices");
  assert.equal(p.status, 200);
  assert.match(p.text, /지난주보다/);
  assert.match(p.text, /전체 품목/);
  assert.match(p.text, /배추/);
  const key = decodeURIComponent(p.text.match(/\/prices\/item\?k=([^"&]+)/)![1]);
  const item = await get(`/prices/item?k=${encodeURIComponent(key)}`);
  assert.equal(item.status, 200);
  assert.match(item.text, /최근 12주 가격/);
  assert.match(item.text, /<svg class="chart"/);
  assert.match(item.text, /지역별 가격/);
  // 정렬 값과 쪽 번호를 받아 첫 화면에 반영하고, 품목마다 정렬용 가격이 붙는다
  const sorted = await get("/prices?s=cheap&pg=2");
  assert.match(sorted.text, /<option value="cheap" selected/);
  assert.match(sorted.text, /data-page="2"/);
  assert.match(p.text, /data-price="\d+"/);
  assert.match(p.text, /id="ppager"/);
  const seoul = await get("/prices?r=1101");
  assert.match(seoul.text, /서울 평균 소매가/);
  const missing = await get("/prices/item?k=x~y~z~w");
  assert.equal(missing.status, 404);
});

await step("cron route requires a trigger delivery; admin route requires token", async () => {
  const noHeader = await get("/cron/prices", { method: "POST", body: "{}" });
  assert.equal(noHeader.status, 401);
  const body = {
    version: 1,
    invocation_id: "inv-test-1",
    trigger: { type: "schedule", id: "trigger-test", name: "prices-twice-daily" },
    data: { scheduled_at: new Date().toISOString() },
  };
  const ok = await get("/cron/prices", {
    method: "POST",
    headers: { "content-type": "application/json", "x-neon-trigger-invocation-id": "inv-test-1" },
    body: JSON.stringify(body),
  });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(JSON.parse(ok.text).status, "ok");
  const unauth = await get("/admin/ingest/prices", { method: "POST" });
  assert.equal(unauth.status, 401);
  const probe = await get("/admin/probe/hygiene", { headers: { authorization: "Bearer test-admin-token" } });
  assert.equal(probe.status, 200);
  assert.ok(JSON.parse(probe.text).keys.includes("PRCSCITYPOINT_BSSHNM"));
  const wrongSvc = await get("/admin/probe/hygiene?svc=I2630", { headers: { authorization: "Bearer test-admin-token" } });
  assert.match(wrongSvc.text, /INFO-110/);
});

await step("design: no emoji, middle dot, dash or arrow glyphs in rendered pages; assets served", async () => {
  const BAD = /[·—–←→↗↘▲▼★☆✓✔•…]|[\u{1F000}-\u{1FAFF}]|[\u2600-\u27BF]|\uFE0F/u;
  const pages = ["/", "/hygiene", "/hygiene?q=" + encodeURIComponent("김밥"), "/hygiene?v=grade", "/prices", "/prices/goods", "/prices/goods/224", "/benefits", "/benefits?list=popular", "/benefits/100000000002", "/about", "/nope"];
  const s0 = await get("/prices");
  pages.push(decodeURIComponent(s0.text.match(/\/prices\/item\?k=[^"]+/)![0]).replace(/&amp;/g, "&"));
  const h0 = await get("/hygiene?q=" + encodeURIComponent("가나다김밥"));
  pages.push(h0.text.match(/\/hygiene\/b\/[0-9a-f]{16}/)![0]);
  for (const path of pages) {
    const html = (await get(path)).text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
    const m = html.match(BAD);
    assert.ok(!m, `${path} contains '${m?.[0]}' near: ${m ? html.slice(Math.max(0, m.index! - 40), m.index! + 20) : ""}`);
  }
  const fav = await get("/favicon.svg");
  assert.equal(fav.status, 200);
  assert.match(fav.headers.get("content-type") ?? "", /image\/svg\+xml/);
  const icon = await get("/assets/icons/search.svg");
  assert.equal(icon.status, 200);
  assert.match(icon.text, /<svg/);
  const logo = await get("/assets/logo-mark.svg");
  assert.equal(logo.status, 200);
});

await step("healthz + about reflect ingest runs", async () => {
  const h = JSON.parse((await get("/healthz")).text);
  assert.equal(h.ok, true);
  assert.ok(h.hygiene > 0 && h.prices > 0);
  const a = await get("/about");
  assert.match(a.text, /데이터 갱신 상태/);
});

console.log("\n" + results.join("\n"));
server.close();
mock.close();
await getPool().end();
process.exit(process.exitCode ?? 0);
