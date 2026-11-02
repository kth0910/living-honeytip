// 소매 가격 수집
//  A) 공공데이터포털 — 한국농수산식품유통공사_일별 도·소매 가격정보 조회 (DATAKR_API_KEY)
//     GET https://apis.data.go.kr/B552845/perDay/price
//         ?serviceKey=&pageNo=&numOfRows=&returnType=JSON&cond[exmn_ymd::EQ]=YYYYMMDD&cond[se_cd::EQ]=01(소매)
//  B) (선택) KAMIS 직접 키가 있으면 dailyPriceByCategoryList 로 평년 가격까지 수집
import { query } from "../db.js";
import { addDays, compact, fetchWithTimeout, parseDate, parsePrice, pick, redact, todayKST } from "../lib/util.js";
import { PRICE_ITEMS } from "./catalog.js";

export const CATEGORY_NAMES: Record<string, string> = {
  "100": "식량작물",
  "200": "채소류",
  "300": "특용작물",
  "400": "과일류",
  "500": "축산물",
  "600": "수산물",
};

type Row = Record<string, unknown>;

export type PriceRecord = {
  surveyDate: string;
  regionCode: string;
  regionName: string;
  categoryCode: string;
  categoryName: string;
  itemCode: string;
  itemName: string;
  kindCode: string;
  kindName: string;
  rankCode: string;
  rankName: string;
  unit: string;
  price: number;
  price1w?: number | null;
  price1m?: number | null;
  price1y?: number | null;
  priceNormal?: number | null;
  samples: number;
  source: string;
};

export class PriceApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/* ------------------------------------------------------------------ */
/* A) data.go.kr perDay                                                 */
/* ------------------------------------------------------------------ */

function dataGoBase(): string {
  return (process.env.DATAKR_API_BASE || "https://apis.data.go.kr/B552845/perDay").replace(/\/$/, "");
}

function serviceKeyParam(): string {
  const key = process.env.DATAKR_API_KEY;
  if (!key) throw new PriceApiError("NO_KEY", "DATAKR_API_KEY 환경변수가 없습니다");
  // 포털은 Encoding/Decoding 두 가지 키를 준다. 이미 인코딩된 키는 그대로 쓴다.
  return /%[0-9A-F]{2}/i.test(key) ? key : encodeURIComponent(key);
}

type RangeQuery = { category: string; item: string; from: string; to: string };

async function fetchPerDayPage(q: RangeQuery, pageNo: number, numOfRows: number) {
  const cond = (k: string) => encodeURIComponent(`cond[${k}]`);
  const qs = [
    `serviceKey=${serviceKeyParam()}`,
    `pageNo=${pageNo}`,
    `numOfRows=${numOfRows}`,
    `returnType=JSON`,
    `${cond("exmn_ymd::GTE")}=${compact(q.from)}`,
    `${cond("exmn_ymd::LTE")}=${compact(q.to)}`,
    `${cond("se_cd::EQ")}=01`, // 01 소매, 02 중도매
    `${cond("ctgry_cd::EQ")}=${q.category}`,
    `${cond("item_cd::EQ")}=${q.item}`,
  ].join("&");
  const url = `${dataGoBase()}/price?${qs}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetchWithTimeout(url, 60_000);
      const text = await res.text();
      if (!res.ok) throw new PriceApiError(`HTTP-${res.status}`, text.slice(0, 200));
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        // 인증 오류는 XML(OpenAPI_ServiceResponse)로 오는 경우가 많다
        const m = text.match(/<returnAuthMsg>(.*?)<\/returnAuthMsg>|<resultMsg>(.*?)<\/resultMsg>/);
        const auth = /SERVICE_KEY|SERVICE_ACCESS_DENIED|LIMITED_NUMBER|returnReasonCode>(20|22|30|31|32)</.test(text);
        throw new PriceApiError(auth ? "AUTH" : "BAD_RESPONSE", m?.[1] ?? m?.[2] ?? text.slice(0, 200));
      }
      const header = json?.response?.header ?? json?.header;
      const code = String(header?.resultCode ?? "00");
      if (code !== "00" && code !== "0" && code !== "000") {
        if (code === "03") return { total: 0, rows: [] as Row[] }; // NODATA
        throw new PriceApiError(`API-${code}`, header?.resultMsg ?? "API 오류");
      }
      const body = json?.response?.body ?? json?.body ?? {};
      let items: any = body.items ?? [];
      if (items && !Array.isArray(items)) items = items.item ?? [];
      if (items && !Array.isArray(items)) items = [items];
      return { total: Number(body.totalCount ?? items.length) || 0, rows: (items ?? []) as Row[] };
    } catch (err) {
      lastErr = err;
      if (err instanceof PriceApiError && /^(API-(20|22|30|31|32|33)|NO_KEY|AUTH)$/.test(err.code)) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  const code = lastErr instanceof PriceApiError ? lastErr.code : "NETWORK";
  throw new PriceApiError(code, redact(lastErr instanceof Error ? lastErr.message : String(lastErr)));
}

/** 한 품목의 기간 자료를 모두 받아 조사일별로 나눈다 */
async function fetchItemRange(q: RangeQuery): Promise<Map<string, Row[]>> {
  const size = 1000;
  const first = await fetchPerDayPage(q, 1, size);
  const rows = [...first.rows];
  const pages = Math.min(Math.ceil(first.total / size), 60);
  for (let p = 2; p <= pages; p++) rows.push(...(await fetchPerDayPage(q, p, size)).rows);
  const byDate = new Map<string, Row[]>();
  for (const r of rows) {
    const d = parseDate(pick(r, ["exmn_ymd"]));
    if (!d) continue;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }
  return byDate;
}

function perDayPrice(row: Row): number | null {
  const direct = pick(row, ["exmn_dd_prc", "exmn_dd_avg_prc", "dd_prc", "exmn_prc", "prc", "price"]);
  if (direct !== undefined) return parsePrice(direct);
  for (const [k, v] of Object.entries(row)) {
    if (/prc|price/i.test(k) && !/cnvs|kg/i.test(k)) return parsePrice(v);
  }
  return null;
}

function unitLabel(row: Row): string {
  const unit = pick(row, ["unit", "unit_nm"]) ?? "";
  const size = pick(row, ["unit_sz", "unit_size"]) ?? "";
  if (!size || /^\d/.test(unit)) return unit;
  return `${size.replace(/\.0+$/, "")}${unit}`; // "10" + "kg(그물망 3포기)" -> "10kg(그물망 3포기)"
}

/** 지역·시장별 원자료를 전국 평균 + 시군구 평균으로 묶는다 */
export function aggregatePerDay(date: string, rows: Row[]): PriceRecord[] {
  type Acc = Omit<PriceRecord, "price" | "samples"> & { sum: number; n: number };
  const groups = new Map<string, Acc>();
  for (const row of rows) {
    const price = perDayPrice(row);
    if (!price) continue;
    const itemCode = pick(row, ["item_cd", "itemcode"]);
    const itemName = pick(row, ["item_nm", "itemname"]);
    if (!itemCode || !itemName) continue;
    const base = {
      surveyDate: date,
      categoryCode: pick(row, ["ctgry_cd", "category_code"]) ?? "",
      categoryName: pick(row, ["ctgry_nm", "category_name"]) ?? "",
      itemCode,
      itemName,
      kindCode: pick(row, ["vrty_cd", "kind_cd"]) ?? "",
      kindName: pick(row, ["vrty_nm", "kind_nm"]) ?? "",
      rankCode: pick(row, ["grd_cd", "rank_cd"]) ?? "",
      rankName: pick(row, ["grd_nm", "rank_nm"]) ?? "",
      unit: unitLabel(row),
      source: "datago-perday",
    };
    if (!base.categoryName) base.categoryName = CATEGORY_NAMES[base.categoryCode] ?? "기타";
    const regions: [string, string][] = [["0000", "전국"]];
    const sggCode = pick(row, ["sgg_cd", "country_cd"]);
    const sggName = pick(row, ["sgg_nm", "country_nm"]);
    if (sggCode && sggName) regions.push([sggCode, sggName]);
    for (const [regionCode, regionName] of regions) {
      const key = [regionCode, base.itemCode, base.kindCode, base.rankCode, base.unit].join("|");
      const acc = groups.get(key) ?? { ...base, regionCode, regionName, sum: 0, n: 0 };
      acc.sum += price;
      acc.n += 1;
      groups.set(key, acc);
    }
  }
  // 여러 조사 지점의 평균이므로 10원 단위로 반올림해 보여준다
  return [...groups.values()].map(({ sum, n, ...r }) => ({
    ...r,
    price: n > 1 ? Math.round(sum / n / 10) * 10 : sum,
    samples: n,
  }));
}

/* ------------------------------------------------------------------ */
/* B) KAMIS dailyPriceByCategoryList (선택)                              */
/* ------------------------------------------------------------------ */

function kamisBase(): string {
  return (process.env.KAMIS_API_BASE || "http://www.kamis.or.kr/service/price/xml.do").replace(/\/$/, "");
}

const KAMIS_LABELS: [RegExp, keyof PriceRecord][] = [
  [/당일|조사일/, "price"],
  [/1주일?전/, "price1w"],
  [/1개월전|한달전/, "price1m"],
  [/1년전/, "price1y"],
  [/평년/, "priceNormal"],
];
// 라벨이 없을 때의 기본 위치: dpr1 당일, dpr3 1주일전, dpr5 1개월전, dpr6 1년전, dpr7 평년
const KAMIS_DEFAULT: Record<string, keyof PriceRecord> = {
  dpr1: "price",
  dpr3: "price1w",
  dpr5: "price1m",
  dpr6: "price1y",
  dpr7: "priceNormal",
};

async function fetchKamisCategory(date: string, category: string): Promise<PriceRecord[]> {
  const params = new URLSearchParams({
    action: "dailyPriceByCategoryList",
    p_cert_key: process.env.KAMIS_CERT_KEY!,
    p_cert_id: process.env.KAMIS_CERT_ID!,
    p_returntype: "json",
    p_product_cls_code: "01",
    p_item_category_code: category,
    p_regday: date,
    p_convert_kg_yn: "N",
  });
  const res = await fetchWithTimeout(`${kamisBase()}?${params}`, 60_000);
  const text = await res.text();
  if (!res.ok) throw new PriceApiError(`HTTP-${res.status}`, redact(text.slice(0, 200)));
  const json = JSON.parse(text);
  const data = json?.data;
  if (Array.isArray(data) && data[0] === "001") return []; // 결과 없음
  const code = data?.error_code ?? "000";
  if (code === "001") return [];
  if (code !== "000") throw new PriceApiError(`KAMIS-${code}`, "KAMIS 오류");
  let items = data?.item ?? [];
  if (!Array.isArray(items)) items = [items];
  const out: PriceRecord[] = [];
  for (const it of items as Row[]) {
    const rec: Partial<PriceRecord> = {};
    for (let i = 1; i <= 7; i++) {
      const label = String(it[`day${i}`] ?? "");
      const hit = KAMIS_LABELS.find(([re]) => re.test(label.replace(/\s/g, "")));
      const field = hit ? hit[1] : KAMIS_DEFAULT[`dpr${i}`];
      if (!field || (rec as any)[field] != null) continue;
      (rec as any)[field] = parsePrice(it[`dpr${i}`]);
    }
    if (!rec.price) continue;
    out.push({
      surveyDate: date,
      regionCode: "0000",
      regionName: "전국",
      categoryCode: category,
      categoryName: CATEGORY_NAMES[category] ?? "기타",
      itemCode: pick(it, ["item_code"]) ?? "",
      itemName: pick(it, ["item_name"]) ?? "",
      kindCode: pick(it, ["kind_code"]) ?? "",
      kindName: pick(it, ["kind_name"]) ?? "",
      rankCode: pick(it, ["rank_code"]) ?? "",
      rankName: pick(it, ["rank"]) ?? "",
      unit: pick(it, ["unit"]) ?? "",
      price: rec.price,
      price1w: rec.price1w ?? null,
      price1m: rec.price1m ?? null,
      price1y: rec.price1y ?? null,
      priceNormal: rec.priceNormal ?? null,
      samples: 1,
      source: "kamis",
    });
  }
  return out;
}

async function fetchKamisAll(date: string): Promise<PriceRecord[]> {
  const out: PriceRecord[] = [];
  for (const c of Object.keys(CATEGORY_NAMES)) out.push(...(await fetchKamisCategory(date, c)));
  return out.filter((r) => r.itemCode && r.itemName);
}

/* ------------------------------------------------------------------ */
/* 저장 + 실행                                                          */
/* ------------------------------------------------------------------ */

export async function upsertPrices(records: PriceRecord[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < records.length; i += 1000) {
    const chunk = records.slice(i, i + 1000);
    await query(
      `INSERT INTO price_daily (survey_date, region_code, region_name, category_code, category_name, item_code,
         item_name, kind_code, kind_name, rank_code, rank_name, unit, price, price_1w, price_1m, price_1y,
         price_normal, samples, source)
       SELECT "surveyDate", "regionCode", "regionName", "categoryCode", "categoryName", "itemCode",
         "itemName", "kindCode", "kindName", "rankCode", "rankName", unit, price, "price1w", "price1m", "price1y",
         "priceNormal", samples, source
       FROM jsonb_to_recordset($1::jsonb) AS x(
         "surveyDate" date, "regionCode" text, "regionName" text, "categoryCode" text, "categoryName" text,
         "itemCode" text, "itemName" text, "kindCode" text, "kindName" text, "rankCode" text, "rankName" text,
         unit text, price numeric, "price1w" numeric, "price1m" numeric, "price1y" numeric,
         "priceNormal" numeric, samples int, source text)
       ON CONFLICT (survey_date, region_code, item_code, kind_code, rank_code, unit) DO UPDATE SET
         price = EXCLUDED.price, price_1w = EXCLUDED.price_1w, price_1m = EXCLUDED.price_1m,
         price_1y = EXCLUDED.price_1y, price_normal = EXCLUDED.price_normal, samples = EXCLUDED.samples,
         category_name = EXCLUDED.category_name, item_name = EXCLUDED.item_name, kind_name = EXCLUDED.kind_name,
         rank_name = EXCLUDED.rank_name, region_name = EXCLUDED.region_name, source = EXCLUDED.source,
         fetched_at = now()`,
      [JSON.stringify(chunk)],
    );
    n += chunk.length;
  }
  return n;
}

function provider(): "kamis" | "datago" {
  if (process.env.KAMIS_CERT_KEY && process.env.KAMIS_CERT_ID) return "kamis";
  return "datago";
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>, deadline: number): Promise<boolean> {
  let i = 0;
  let timedOut = false;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      if (Date.now() > deadline) {
        timedOut = true;
        return;
      }
      await fn(items[i++]);
    }
  });
  await Promise.all(workers);
  return !timedOut;
}

/**
 * 공공데이터포털(aT): 품목마다 '마지막으로 받은 날 - 7일 ~ 오늘' 구간을 받는다(처음이면 9주치).
 * 1년 전 같은 시기(2주 구간)도 한 번 받아 둔다. 오래 안 받은 품목부터 처리해서
 * 시간이 모자라 중간에 끊겨도 다음 실행에서 이어진다.
 */
async function ingestDataGo(deadline: number) {
  const today = todayKST();
  const log: string[] = ["provider=datago"];
  const last = new Map(
    (await query<{ item_code: string; d: string }>(
      `SELECT item_code, max(survey_date) AS d FROM price_daily WHERE region_code = '0000' AND source = 'datago-perday' GROUP BY item_code`,
    )).map((r) => [r.item_code, r.d]),
  );
  const [st] = await query<{ state: { yearAgo?: Record<string, string> } }>(
    `SELECT state FROM ingest_state WHERE job = 'prices_year_ago'`,
  );
  const yearAgo: Record<string, string> = st?.state?.yearAgo ?? {};
  const items = [...PRICE_ITEMS].sort((a, b) => (last.get(a[1]) ?? "").localeCompare(last.get(b[1]) ?? ""));
  let saved = 0;
  const errors: string[] = [];
  const done = await pool(
    items,
    5,
    async ([category, item, name]) => {
      const lastDate = last.get(item);
      const from = lastDate ? addDays(lastDate, -7) : addDays(today, -63);
      try {
        const byDate = await fetchItemRange({ category, item, from, to: today });
        const recs = [...byDate.entries()].flatMap(([d, rows]) => aggregatePerDay(d, rows));
        saved += await upsertPrices(recs);
        // 1년 전 같은 시기: 품목마다 한 달에 한 번만 시도
        const ya = yearAgo[item];
        if (!ya || Date.now() - Date.parse(ya) > 30 * 86400_000) {
          const yb = await fetchItemRange({ category, item, from: addDays(today, -372), to: addDays(today, -355) });
          saved += await upsertPrices([...yb.entries()].flatMap(([d, rows]) => aggregatePerDay(d, rows)));
          yearAgo[item] = new Date().toISOString();
        }
      } catch (err) {
        errors.push(`${name}: ${(err as Error).message}`);
        if (err instanceof PriceApiError && /^(AUTH|NO_KEY|API-(20|22|30|31|32|33))$/.test(err.code)) throw err;
      }
    },
    deadline,
  );
  await query(
    `INSERT INTO ingest_state (job, state, updated_at) VALUES ('prices_year_ago', $1, now())
     ON CONFLICT (job) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [JSON.stringify({ yearAgo })],
  );
  if (!done) log.push("시간 제한으로 일부 품목은 다음 실행에서 이어 받음");
  if (errors.length) log.push(`오류 ${errors.length}건: ${errors.slice(0, 3).join(" / ")}`);
  if (errors.length === items.length) throw new PriceApiError("ALL_FAILED", errors[0] ?? "모든 품목 실패");
  const [latest] = await query<{ d: string | null }>(`SELECT max(survey_date) AS d FROM price_daily WHERE region_code = '0000'`);
  log.push(`최근 조사일 ${latest?.d ?? "-"}`);
  return { rows: saved, message: log.join(" · "), partial: !done || errors.length > 0 };
}

/**
 * KAMIS(선택): 최근 조사일을 찾아 저장하고, 1~8주 전과 1년 전 같은 시기도 채운다.
 * (주말·공휴일은 조사가 없어서 앞쪽 날짜로 최대 며칠씩 물러나며 찾는다)
 */
async function ingestKamis(deadline: number) {
  const log: string[] = ["provider=kamis"];
  let saved = 0;
  const today = todayKST();
  let latest: string | null = null;
  for (let i = 0; i <= 7 && !latest; i++) {
    const d = addDays(today, -i);
    const recs = await fetchKamisAll(d);
    if (recs.length) {
      saved += await upsertPrices(recs);
      latest = d;
    }
  }
  if (!latest) return { rows: 0, message: "최근 7일간 조사 자료가 없습니다", partial: true };
  log.push(`최근 조사일 ${latest}`);
  const have = new Set(
    (await query<{ d: string }>(
      `SELECT DISTINCT survey_date AS d FROM price_daily WHERE region_code = '0000' AND survey_date >= $1`,
      [addDays(latest, -400)],
    )).map((r) => r.d),
  );
  let partial = false;
  for (const n of [7, 14, 21, 28, 35, 42, 49, 56, 364]) {
    const target = addDays(latest, -n);
    if (Date.now() > deadline) {
      partial = true;
      break;
    }
    if ([0, 1, 2, 3].some((k) => have.has(addDays(target, -k)))) continue;
    for (let k = 0; k <= 3; k++) {
      const recs = await fetchKamisAll(addDays(target, -k));
      if (recs.length) {
        saved += await upsertPrices(recs);
        break;
      }
    }
  }
  return { rows: saved, message: log.join(" · "), partial };
}

export async function ingestPrices(opts: { budgetMs?: number } = {}) {
  const deadline = Date.now() + (opts.budgetMs ?? 8 * 60_000);
  return provider() === "kamis" ? ingestKamis(deadline) : ingestDataGo(deadline);
}
