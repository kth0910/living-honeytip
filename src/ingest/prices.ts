// 소매 가격 수집
//  A) 공공데이터포털 — 한국농수산식품유통공사_일별 도·소매 가격정보 조회 (DATAKR_API_KEY)
//     GET https://apis.data.go.kr/B552845/perDay/price
//         ?serviceKey=&pageNo=&numOfRows=&returnType=JSON&cond[exmn_ymd::EQ]=YYYYMMDD&cond[se_cd::EQ]=01(소매)
//  B) (선택) KAMIS 직접 키가 있으면 dailyPriceByCategoryList 로 평년 가격까지 수집
import { query } from "../db.js";
import { addDays, compact, fetchWithTimeout, parsePrice, pick, redact, todayKST } from "../lib/util.js";

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

async function fetchPerDayPage(date: string, pageNo: number, numOfRows: number) {
  const qs = [
    `serviceKey=${serviceKeyParam()}`,
    `pageNo=${pageNo}`,
    `numOfRows=${numOfRows}`,
    `returnType=JSON`,
    `${encodeURIComponent("cond[exmn_ymd::EQ]")}=${compact(date)}`,
    `${encodeURIComponent("cond[se_cd::EQ]")}=01`,
  ].join("&");
  const url = `${dataGoBase()}/price?${qs}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
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

async function fetchPerDayAll(date: string): Promise<Row[]> {
  const size = 1000;
  const first = await fetchPerDayPage(date, 1, size);
  const rows = [...first.rows];
  const pages = Math.min(Math.ceil(first.total / size), 30);
  for (let p = 2; p <= pages; p++) rows.push(...(await fetchPerDayPage(date, p, size)).rows);
  return rows;
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
  if (!size || /\d/.test(unit)) return unit;
  return `${size.replace(/\.0+$/, "")}${unit}`;
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

async function fetchDay(date: string): Promise<PriceRecord[]> {
  if (provider() === "kamis") return fetchKamisAll(date);
  return aggregatePerDay(date, await fetchPerDayAll(date));
}

/**
 * 가장 최근 조사일을 찾아 저장하고, 비교용으로 1~8주 전과 1년 전 같은 시기 가격도 채운다.
 * (주말·공휴일은 조사가 없어서 앞쪽 날짜로 최대 며칠씩 물러나며 찾는다)
 */
export async function ingestPrices(opts: { budgetMs?: number } = {}) {
  const deadline = Date.now() + (opts.budgetMs ?? 8 * 60_000);
  const log: string[] = [`provider=${provider()}`];
  let saved = 0;

  const today = todayKST();
  let latest: string | null = null;
  for (let i = 0; i <= 7 && !latest; i++) {
    const d = addDays(today, -i);
    const recs = await fetchDay(d);
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
  const targets = [7, 14, 21, 28, 35, 42, 49, 56, 364].map((n) => addDays(latest!, -n));
  let partial = false;
  for (const target of targets) {
    if (Date.now() > deadline) {
      partial = true;
      break;
    }
    // 이미 그 주(목표일 포함 이전 3일)에 자료가 있으면 건너뛴다
    if ([0, 1, 2, 3].some((k) => have.has(addDays(target, -k)))) continue;
    for (let k = 0; k <= 3; k++) {
      const d = addDays(target, -k);
      try {
        const recs = await fetchDay(d);
        if (recs.length) {
          saved += await upsertPrices(recs);
          break;
        }
      } catch (err) {
        log.push(`${d}: ${(err as Error).message}`);
        partial = true;
        break;
      }
    }
  }
  return { rows: saved, message: log.join(" · "), partial };
}
