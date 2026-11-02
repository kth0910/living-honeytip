import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { parseTriggerDelivery } from "@neon/functions/triggers";
import { ensureSchema, query } from "./db.js";
import {
  businessActions,
  hygieneRegions,
  hygieneStats,
  lastRuns,
  latestPriceDate,
  priceByRegion,
  priceHistory,
  priceList,
  priceRegions,
  searchBusinesses,
  sinceForHistory,
  weeklyChange,
} from "./data.js";
import { runJob, type Job } from "./ingest/run.js";
import { splitRegionParam } from "./lib/region.js";
import { violationTags } from "./lib/severity.js";
import { Layout, Empty } from "./views/layout.js";
import { HygienePage, BusinessPage, type HygieneQuery } from "./views/hygiene.js";
import { PricesPage, PriceItemPage } from "./views/prices.js";
import { HomePage, AboutPage } from "./views/home.js";
import { fetchPage as fetchFoodSafetyPage } from "./ingest/hygiene.js";
import { redact } from "./lib/util.js";

const app = new Hono();
const YEAR = 365 * 86400;

app.use("*", async (c, next) => {
  try {
    await ensureSchema();
  } catch (err) {
    console.error("[schema]", redact(String(err)));
    return c.html(
      <Layout title="잠시 문제가 생겼어요" tab="home">
        <Empty icon="🛠️" title="잠시 문제가 생겼어요">
          데이터베이스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.
        </Empty>
      </Layout>,
      503,
    );
  }
  await next();
  if (c.req.method === "GET" && c.res.headers.get("content-type")?.includes("text/html") && c.res.status === 200) {
    c.header("Cache-Control", "private, no-cache"); // 지역 쿠키에 따라 내용이 달라지므로 매번 확인
  }
});

app.onError((err, c) => {
  console.error("[error]", redact(err?.stack ?? String(err)));
  return c.html(
    <Layout title="문제가 생겼어요" tab="home">
      <Empty icon="😵" title="페이지를 보여드리지 못했어요">
        일시적인 문제일 수 있어요. <a href={c.req.path}>다시 시도</a>하거나 <a href="/">처음으로</a> 돌아가 주세요.
      </Empty>
    </Layout>,
    500,
  );
});

app.notFound((c) =>
  c.html(
    <Layout title="페이지를 찾을 수 없어요" tab="home">
      <Empty icon="🧭" title="페이지를 찾을 수 없어요">
        주소가 바뀌었거나 없는 페이지예요. <a href="/">처음으로</a> 돌아가 주세요.
      </Empty>
    </Layout>,
    404,
  ),
);

/* ------------------------------ helpers ------------------------------ */

function rememberedHygieneRegion(c: Context): string {
  const param = c.req.query("r");
  if (param !== undefined) {
    const { sido, sigungu } = splitRegionParam(param);
    const v = sido ? [sido, sigungu].filter(Boolean).join(" ") : "";
    if (v) setCookie(c, "region", encodeURIComponent(v), { path: "/", maxAge: YEAR, sameSite: "Lax" });
    else deleteCookie(c, "region", { path: "/" });
    return v;
  }
  const cookie = getCookie(c, "region");
  if (!cookie) return "";
  const { sido, sigungu } = splitRegionParam(decodeURIComponent(cookie));
  return sido ? [sido, sigungu].filter(Boolean).join(" ") : "";
}

function rememberedPriceRegion(c: Context): string {
  const param = c.req.query("r");
  if (param !== undefined) {
    const v = /^[0-9A-Za-z]{1,10}$/.test(param) ? param : "";
    if (v && v !== "0000") setCookie(c, "pregion", v, { path: "/", maxAge: YEAR, sameSite: "Lax" });
    else deleteCookie(c, "pregion", { path: "/" });
    return v || "0000";
  }
  const cookie = getCookie(c, "pregion");
  return cookie && /^[0-9A-Za-z]{1,10}$/.test(cookie) ? cookie : "0000";
}

/* ------------------------------ pages ------------------------------ */

app.get("/", async (c) => {
  const region = rememberedHygieneRegion(c);
  const { sido, sigungu } = splitRegionParam(region);
  const [regions, recent, runs, date] = await Promise.all([
    hygieneRegions(),
    searchBusinesses({ sido, sigungu, sinceDays: 365, pageSize: 5 }),
    lastRuns(),
    latestPriceDate(),
  ]);
  let drops: any[] = [];
  let rises: any[] = [];
  if (date) {
    const rows = (await priceList("0000", date)).map((r) => ({ r, ch: weeklyChange(r) })).filter((x) => x.ch !== null);
    drops = rows.filter((x) => x.ch! <= -0.05).sort((a, b) => a.ch! - b.ch!).slice(0, 3).map((x) => x.r);
    rises = rows.filter((x) => x.ch! >= 0.05).sort((a, b) => b.ch! - a.ch!).slice(0, 2).map((x) => x.r);
  }
  return c.html(
    <Layout title="홈" tab="home" runs={runs}>
      <HomePage region={region} regions={regions} recent={recent.items} priceDate={date} drops={drops} rises={rises} />
    </Layout>,
  );
});

app.get("/hygiene", async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 60);
  const region = rememberedHygieneRegion(c);
  const sev = Math.min(3, Math.max(1, Number(c.req.query("sev")) || 1));
  const pParam = c.req.query("p");
  const period = pParam === "1y" || pParam === "3y" || pParam === "all" ? pParam : q ? "all" : "1y";
  const page = Math.min(500, Math.max(1, Number(c.req.query("page")) || 1));
  const hq: HygieneQuery = { q, region, sev, period, page };
  const { sido, sigungu } = splitRegionParam(region);
  const sinceDays = period === "1y" ? 365 : period === "3y" ? 1095 : null;
  const pageSize = 20;

  const [regions, result, runs, any] = await Promise.all([
    hygieneRegions(),
    searchBusinesses({ q, sido, sigungu, minSeverity: sev, sinceDays, page, pageSize }),
    lastRuns(),
    query<{ ok: boolean }>(`SELECT EXISTS (SELECT 1 FROM hygiene_actions) AS ok`),
  ]);
  let stats = null;
  if (!q && any[0]?.ok) {
    const s = await hygieneStats({ sido, sigungu, sinceDays });
    const counts = new Map<string, number>();
    for (const v of s.violations) for (const t of violationTags(v)) counts.set(t, (counts.get(t) ?? 0) + 1);
    stats = { ...s, topTags: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) };
  }
  const periodLabel = period === "1y" ? "최근 1년" : period === "3y" ? "최근 3년" : "전체 기간";
  return c.html(
    <Layout
      title={q ? `‘${q}’ 위생 기록` : "식당 위생 체크"}
      description="식당·카페의 위생 위반(행정처분) 기록을 가게 이름이나 동네로 찾아보세요."
      tab="hygiene"
      runs={runs}
    >
      <HygienePage
        q={hq}
        regions={regions}
        items={result.items}
        total={result.total}
        pageSize={pageSize}
        stats={stats}
        hasData={!!any[0]?.ok}
        ingestFailing={!runs.hygiene?.lastOk && runs.hygiene?.last?.status === "error"}
        regionLabel={region || "전국"}
        periodLabel={periodLabel}
      />
    </Layout>,
  );
});

app.get("/hygiene/b/:key", async (c) => {
  const key = c.req.param("key");
  if (!/^[0-9a-f]{16}$/.test(key)) return c.notFound();
  const [actions, runs] = await Promise.all([businessActions(key), lastRuns()]);
  if (!actions.length) return c.notFound();
  return c.html(
    <Layout
      title={`${actions[0].biz_name} 위생 기록`}
      description={`${actions[0].biz_name}의 행정처분 기록 ${actions.length}건`}
      tab="hygiene"
      runs={runs}
    >
      <BusinessPage actions={actions} />
    </Layout>,
  );
});

app.get("/prices", async (c) => {
  let region = rememberedPriceRegion(c);
  let date = await latestPriceDate(region);
  if (!date && region !== "0000") {
    region = "0000";
    date = await latestPriceDate(region);
  }
  const [rows, regions, runs] = await Promise.all([
    date ? priceList(region, date) : Promise.resolve([]),
    date ? priceRegions(date) : Promise.resolve([]),
    lastRuns(),
  ]);
  const regionName = regions.find((r) => r.region_code === region)?.region_name ?? "전국";
  const cParam = c.req.query("c") ?? "";
  const sParam = c.req.query("s") ?? "cat";
  return c.html(
    <Layout
      title="이번 주 장보기 시세"
      description="채소·과일·고기·생선 소매가격을 지난주와 비교해 보여드려요."
      tab="prices"
      runs={runs}
    >
      <PricesPage
        rows={rows}
        date={date}
        region={region}
        regionName={regionName}
        regions={regions}
        init={{
          c: /^\d{3}$/.test(cParam) ? cParam : "",
          q: (c.req.query("q") ?? "").slice(0, 30),
          s: ["cat", "drop", "rise", "name"].includes(sParam) ? sParam : "cat",
        }}
      />
    </Layout>,
  );
});

app.get("/prices/item", async (c) => {
  const k = c.req.query("k") ?? "";
  const parts = k.split("~");
  if (parts.length !== 4) return c.notFound();
  const [item_code, kind_code, rank_code, unit] = parts;
  const rParam = c.req.query("r");
  const region = rParam && /^[0-9A-Za-z]{1,10}$/.test(rParam) ? rParam : "0000";
  const date = await latestPriceDate(region);
  if (!date) return c.notFound();
  const rows = await priceList(region, date);
  const r = rows.find((x) => x.key === k);
  if (!r) return c.notFound();
  const key = { item_code, kind_code, rank_code, unit };
  const [history, byRegion, regions, runs] = await Promise.all([
    priceHistory(region, key, sinceForHistory(date)),
    region === "0000" ? priceByRegion(date, key) : Promise.resolve([]),
    priceRegions(date),
    lastRuns(),
  ]);
  const regionName = regions.find((g) => g.region_code === region)?.region_name ?? "전국";
  return c.html(
    <Layout title={`${r.item_name} 가격`} description={`${r.item_name} 이번 주 소매가격과 지난주 대비 변동`} tab="prices" runs={runs}>
      <PriceItemPage r={r} history={history} regionName={regionName} regionCode={region} byRegion={byRegion} />
    </Layout>,
  );
});

app.get("/about", async (c) => {
  const runs = await lastRuns();
  return c.html(
    <Layout title="이 서비스에 대해" tab="about" runs={runs}>
      <AboutPage runs={runs} />
    </Layout>,
  );
});

app.get("/healthz", async (c) => {
  const [r] = await query<{ hygiene: number; prices: number; latest_price: string | null }>(
    `SELECT (SELECT count(*) FROM hygiene_actions)::int AS hygiene,
            (SELECT count(*) FROM price_daily)::int AS prices,
            (SELECT max(survey_date) FROM price_daily) AS latest_price`,
  );
  return c.json({ ok: true, ...r, runs: await lastRuns() });
});

/* ------------------------------ ingest ------------------------------ */

const JOBS: Job[] = ["hygiene", "prices"];

// Neon Function Trigger (cron) → POST /cron/:job. 헤더/본문 검증은 parseTriggerDelivery가 한다.
app.post("/cron/:job", async (c) => {
  const job = c.req.param("job") as Job;
  if (!JOBS.includes(job)) return c.json({ error: "unknown job" }, 404);
  const parsed = await parseTriggerDelivery(c.req.raw);
  if (!parsed.ok) return c.json({ error: parsed.error }, 401);
  const result = await runJob(job, `trigger:${parsed.invocation.trigger.name}`);
  return c.json(result, result.status === "error" ? 502 : 200);
});

function isAdmin(c: Context): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  return c.req.header("authorization") === `Bearer ${token}`;
}

// 수동 실행: curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" <url>/admin/ingest/prices
app.post("/admin/ingest/:job", async (c) => {
  if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
  const job = c.req.param("job") as Job;
  if (!JOBS.includes(job)) return c.json({ error: "unknown job" }, 404);
  const budget = Math.min(13 * 60_000, Number(c.req.query("budgetMs")) || 8 * 60_000);
  return c.json(await runJob(job, "admin", { budgetMs: budget }));
});

// 데이터 API 서버 접속 진단 (고정된 공개 주소만 확인, 키 사용 안 함)
app.get("/netcheck", async (c) => {
  const targets: [string, string][] = [
    ["foodsafetykorea", "http://openapi.foodsafetykorea.go.kr/api/sample/I2630/json/1/1"],
    ["datago", "https://apis.data.go.kr/B552845/perDay/price"],
    ["kamis", "http://www.kamis.or.kr/service/price/xml.do"],
  ];
  const out: Record<string, string> = {};
  await Promise.all(
    targets.map(async ([name, url]) => {
      const t = Date.now();
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        out[name] = `HTTP ${res.status} (${Date.now() - t}ms)`;
      } catch (err) {
        out[name] = `ERROR ${(err as Error).message} (${Date.now() - t}ms)`;
      }
    }),
  );
  return c.json(out);
});

// 처음 한 번만: 미리 받아 둔 공공 가격 자료(NDJSON.gz)를 비어 있는 DB에 채운다.
// 같은 프로젝트의 비공개 'deploy' 버킷에서 발급한 주소만 받는다.
app.post("/admin/seed-prices", async (c) => {
  const src = c.req.query("src") ?? "";
  let u: URL;
  try {
    u = new URL(src);
  } catch {
    return c.json({ error: "bad src" }, 400);
  }
  if (!/\.storage\.[a-z0-9.-]+\.neon\.tech$/.test(u.hostname) || !u.pathname.startsWith("/deploy/seed/")) {
    return c.json({ error: "src not allowed" }, 403);
  }
  const [{ n }] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM price_daily`);
  if (n > 0) return c.json({ error: "already seeded", rows: n }, 409);
  const res = await fetch(u, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok || !res.body) return c.json({ error: `fetch ${res.status}` }, 502);
  const { gunzipSync } = await import("node:zlib");
  const text = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
  const { upsertPrices } = await import("./ingest/prices.js");
  const recs = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const saved = await upsertPrices(recs);
  await query(`INSERT INTO ingest_runs (job, trigger, finished_at, status, rows, message) VALUES ('prices','seed',now(),'ok',$1,'초기 자료 적재')`, [saved]);
  return c.json({ ok: true, rows: saved });
});

// 원본 응답의 필드 이름 확인용 (키는 노출하지 않음)
app.get("/admin/probe/hygiene", async (c) => {
  if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
  try {
    const { total, rows } = await fetchFoodSafetyPage(1, 3);
    return c.json({ total, keys: rows[0] ? Object.keys(rows[0]) : [], sample: rows.slice(0, 2) });
  } catch (err) {
    return c.json({ error: redact(`${(err as any).code ?? ""} ${(err as Error).message}`) }, 502);
  }
});

export default app;
