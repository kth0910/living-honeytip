// 한국소비자원 생필품 가격 정보 (참가격, 공공데이터포털 15158701)
//   GET {base}/getStandardInfoSvc.do?classCode=AL   상품 분류 (상위코드로 계층)
//   GET {base}/getProductInfoSvc.do                 상품 목록 (약 600개)
//   GET {base}/getStoreInfoSvc.do                   판매점 목록 (대형마트 LM, 슈퍼 SM, 백화점 DP, 편의점 CS)
//   GET {base}/getProductPriceInfoSvc?goodInspectDay=YYYYMMDD&goodId=   그날 그 상품의 판매점별 가격
// 조사는 약 2주마다 금요일에 하고, 며칠 뒤에 올라온다. 개발 계정은 하루 2,000번 호출 제한.
import { query } from "../db.js";
import { parseRegion } from "../lib/region.js";
import { addDays, compact, fetchWithTimeout, parseDate, redact, todayKST } from "../lib/util.js";

type Row = Record<string, string>;

function base(): string {
  return (process.env.GOODS_API_BASE || "https://apis.data.go.kr/B551919/ProductPriceInfoService").replace(/\/$/, "");
}
function keyParam(): string {
  const key = process.env.DATAKR_API_KEY;
  if (!key) throw new Error("NO_KEY DATAKR_API_KEY 환경변수가 없습니다");
  return /%[0-9A-F]{2}/i.test(key) ? key : encodeURIComponent(key);
}

/** 이 API는 XML만 준다. 단순한 구조라 태그 단위로 읽는다. */
export function parseItems(xml: string, tag: string): Row[] {
  const out: Row[] = [];
  const re = new RegExp(`<${tag.replace(/\./g, "\\.")}>([\\s\\S]*?)</${tag.replace(/\./g, "\\.")}>`, "g");
  for (const m of xml.matchAll(re)) {
    const row: Row = {};
    for (const f of m[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) {
      row[f[1]] = f[2]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .trim();
    }
    out.push(row);
  }
  return out;
}

let calls = 0;
async function get(path: string, params: Record<string, string> = {}): Promise<string> {
  const qs = new URLSearchParams(params).toString();
  const url = `${base()}/${path}?serviceKey=${keyParam()}${qs ? `&${qs}` : ""}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      calls++;
      const res = await fetchWithTimeout(url, 60_000);
      const text = await res.text();
      if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE_ACCESS_DENIED|LIMITED_NUMBER_OF_SERVICE_REQUESTS/.test(text)) {
        throw Object.assign(new Error(`AUTH ${text.match(/<returnAuthMsg>(.*?)</)?.[1] ?? "인증 오류"}`), { fatal: true });
      }
      if (!res.ok) throw new Error(`HTTP-${res.status}`);
      return text;
    } catch (err) {
      lastErr = err;
      if ((err as any)?.fatal) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error(redact((lastErr as Error)?.message ?? String(lastErr)));
}

const STORE_TYPES: Record<string, string> = { LM: "대형마트", SM: "슈퍼마켓", DP: "백화점", CS: "편의점", TM: "전통시장" };

async function syncCatalog() {
  // 분류: 상위코드를 따라 대분류, 중분류를 붙인다
  const cats = parseItems(await get("getStandardInfoSvc.do", { classCode: "AL" }), "iros.openapi.service.vo.stdInfoVO");
  const byCode = new Map(cats.map((c) => [c.code, c]));
  const top = (code: string): Row | undefined => {
    let c = byCode.get(code);
    while (c?.highCode && byCode.get(c.highCode)) c = byCode.get(c.highCode);
    return c;
  };
  const mid = (code: string): Row | undefined => {
    const c = byCode.get(code);
    return c?.highCode ? byCode.get(c.highCode) : undefined;
  };
  const units = new Map(
    parseItems(await get("getStandardInfoSvc.do", { classCode: "UT" }), "iros.openapi.service.vo.stdInfoVO").map((u) => [
      u.code,
      u.codeName,
    ]),
  );
  const areas = new Map(
    parseItems(await get("getStandardInfoSvc.do", { classCode: "AR" }), "iros.openapi.service.vo.stdInfoVO").map((a) => [
      a.code,
      a,
    ]),
  );

  const goods = parseItems(await get("getProductInfoSvc.do"), "item").map((g) => ({
    id: g.goodId,
    name: g.goodName,
    smallCode: g.goodSmlclsCode ?? null,
    smallName: byCode.get(g.goodSmlclsCode)?.codeName ?? null,
    midName: mid(g.goodSmlclsCode)?.codeName ?? null,
    topName: top(g.goodSmlclsCode)?.codeName ?? null,
    totalCnt: g.goodTotalCnt ?? null,
    totalUnit: units.get(g.goodTotalDivCode) ?? g.goodTotalDivCode ?? null,
    detail: g.detailMean ?? null,
  }));
  await query(
    `INSERT INTO goods (id, name, small_code, small_name, mid_name, top_name, total_cnt, total_unit, detail)
     SELECT id, name, "smallCode", "smallName", "midName", "topName", "totalCnt", "totalUnit", detail
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, name text, "smallCode" text, "smallName" text,
            "midName" text, "topName" text, "totalCnt" text, "totalUnit" text, detail text)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, small_code = EXCLUDED.small_code,
       small_name = EXCLUDED.small_name, mid_name = EXCLUDED.mid_name, top_name = EXCLUDED.top_name,
       total_cnt = EXCLUDED.total_cnt, total_unit = EXCLUDED.total_unit, detail = EXCLUDED.detail`,
    [JSON.stringify(goods)],
  );

  const stores = parseItems(await get("getStoreInfoSvc.do"), "iros.openapi.service.vo.entpInfoVO").map((s) => {
    const addr = [s.roadAddrBasic, s.plmkAddrBasic].find(Boolean) ?? null;
    let { sido, sigungu } = parseRegion(addr);
    if (!sido) {
      const area = areas.get(s.entpAreaCode);
      sido = parseRegion(area?.codeName ?? null).sido;
    }
    return {
      id: s.entpId,
      name: s.entpName,
      typeCode: s.entpTypeCode ?? null,
      typeName: STORE_TYPES[s.entpTypeCode] ?? s.entpTypeCode ?? null,
      addr,
      sido,
      sigungu,
    };
  });
  await query(
    `INSERT INTO goods_stores (id, name, type_code, type_name, addr, sido, sigungu)
     SELECT id, name, "typeCode", "typeName", addr, sido, sigungu
       FROM jsonb_to_recordset($1::jsonb) AS x(id text, name text, "typeCode" text, "typeName" text, addr text,
            sido text, sigungu text)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type_code = EXCLUDED.type_code,
       type_name = EXCLUDED.type_name, addr = EXCLUDED.addr, sido = EXCLUDED.sido, sigungu = EXCLUDED.sigungu`,
    [JSON.stringify(stores)],
  );
  return { goods: goods.length, stores: stores.length };
}

/** 가장 최근 조사일 찾기: 흔한 상품 하나로 오늘부터 거꾸로 금요일 위주로 확인 */
async function findLatestSurvey(probeGoodId: string, before: string): Promise<string | null> {
  for (let back = 0; back < 35; back++) {
    const d = addDays(before, -back);
    const dow = new Date(d + "T00:00:00Z").getUTCDay();
    if (dow !== 5 && back > 0) continue; // 조사는 금요일. 오늘 날짜만 예외로 확인
    const xml = await get("getProductPriceInfoSvc", { goodInspectDay: compact(d), goodId: probeGoodId });
    if (parseItems(xml, "iros.openapi.service.vo.goodPriceVO").length) return d;
  }
  return null;
}

async function savePrices(day: string, goodId: string): Promise<number> {
  const xml = await get("getProductPriceInfoSvc", { goodInspectDay: compact(day), goodId });
  const rows = parseItems(xml, "iros.openapi.service.vo.goodPriceVO")
    .map((r) => ({
      day,
      goodId,
      storeId: r.entpId,
      price: Number(r.goodPrice),
      dc: r.goodDcYn === "Y",
      plusone: r.plusoneYn === "Y",
      dcStart: parseDate(r.goodDcStartDay),
      dcEnd: parseDate(r.goodDcEndDay),
    }))
    .filter((r) => r.storeId && r.price > 0);
  if (rows.length) {
    await query(
      `INSERT INTO goods_prices (survey_day, good_id, store_id, price, discount, plusone, dc_start, dc_end)
       SELECT day, "goodId", "storeId", price, dc, plusone, "dcStart", "dcEnd"
         FROM jsonb_to_recordset($1::jsonb) AS x(day date, "goodId" text, "storeId" text, price int, dc boolean,
              plusone boolean, "dcStart" date, "dcEnd" date)
       ON CONFLICT (survey_day, good_id, store_id) DO UPDATE SET price = EXCLUDED.price, discount = EXCLUDED.discount,
         plusone = EXCLUDED.plusone, dc_start = EXCLUDED.dc_start, dc_end = EXCLUDED.dc_end`,
      [JSON.stringify(rows)],
    );
  }
  return rows.length;
}

/** 조사일 하나의 상품별 요약(전국, 시도별)을 다시 계산한다 */
async function summarize(day: string) {
  await query(`DELETE FROM goods_stats WHERE survey_day = $1`, [day]);
  await query(
    `INSERT INTO goods_stats (survey_day, good_id, region, n, avg_price, min_price, max_price,
       lm_avg, sm_avg, dp_avg, cs_avg, discounts, plusones)
     SELECT p.survey_day, p.good_id, coalesce(s.sido, '0000') AS region, count(*), round(avg(p.price)), min(p.price), max(p.price),
            round(avg(p.price) FILTER (WHERE s.type_code = 'LM')), round(avg(p.price) FILTER (WHERE s.type_code = 'SM')),
            round(avg(p.price) FILTER (WHERE s.type_code = 'DP')), round(avg(p.price) FILTER (WHERE s.type_code = 'CS')),
            count(*) FILTER (WHERE p.discount), count(*) FILTER (WHERE p.plusone)
       FROM goods_prices p JOIN goods_stores s ON s.id = p.store_id
      WHERE p.survey_day = $1
      GROUP BY GROUPING SETS ((p.survey_day, p.good_id), (p.survey_day, p.good_id, s.sido))
     HAVING NOT (grouping(s.sido) = 0 AND s.sido IS NULL)`,
    [day],
  );
}

type State = { day?: string; done?: string[]; prevDay?: string; prevDone?: string[]; finished?: string[]; checkedAt?: string };

/**
 * 최근 조사일과 그 전 조사일(약 2주 전)의 가격을 받는다. 상품마다 한 번씩 부르므로
 * 시간이나 호출 수가 모자라면 받은 상품을 기록해 두고 다음 실행에서 이어 받는다.
 */
export async function ingestGoods(opts: { budgetMs?: number } = {}) {
  calls = 0;
  const deadline = Date.now() + (opts.budgetMs ?? 8 * 60_000);
  const maxCalls = Number(process.env.GOODS_MAX_CALLS_PER_RUN) || 1800;
  const log: string[] = [];
  {
    // 이미 다 받았고 20시간 안에 확인했으면 호출 없이 끝낸다 (하루 호출 제한 보호)
    const [row] = await query<{ state: State }>(`SELECT state FROM ingest_state WHERE job = 'goods'`);
    const s0 = row?.state;
    const fin = new Set(s0?.finished ?? []);
    if (s0?.checkedAt && Date.now() - Date.parse(s0.checkedAt) < 20 * 3600_000 && s0.day && fin.has(s0.day) && (!s0.prevDay || fin.has(s0.prevDay))) {
      return { rows: 0, message: `${s0.day} 조사까지 모두 받아 둠, 다음 확인은 내일`, partial: false };
    }
  }
  const cat = await syncCatalog();
  log.push(`상품 ${cat.goods}개, 판매점 ${cat.stores}곳`);

  const goods = (await query<{ id: string }>(`SELECT id FROM goods ORDER BY id::int`)).map((g) => g.id);
  const [stRow] = await query<{ state: State }>(`SELECT state FROM ingest_state WHERE job = 'goods'`);
  const st: State = stRow?.state ?? {};
  const probe = goods.includes("224") ? "224" : goods[0];
  const latest = await findLatestSurvey(probe, todayKST());
  if (!latest) return { rows: 0, message: log.concat("최근 조사 자료를 찾지 못함").join(", "), partial: true };
  const finished = new Set(st.finished ?? []);
  // 비교용 이전 조사일: 2주 전 금요일부터 거꾸로
  const prev = st.prevDay && st.day === latest ? st.prevDay : await findLatestSurvey(probe, addDays(latest, -7));

  let saved = 0;
  for (const day of [latest, prev].filter((d): d is string => !!d)) {
    if (finished.has(day)) continue;
    const done = new Set(day === st.day ? st.done ?? [] : day === st.prevDay ? st.prevDone ?? [] : []);
    for (const id of goods) {
      if (done.has(id)) continue;
      if (Date.now() > deadline || calls >= maxCalls) break;
      saved += await savePrices(day, id);
      done.add(id);
    }
    const complete = goods.every((id) => done.has(id));
    if (day === latest) Object.assign(st, { day, done: [...done] });
    else Object.assign(st, { prevDay: day, prevDone: [...done] });
    if (complete) {
      await summarize(day);
      finished.add(day);
      log.push(`${day} 조사 ${goods.length}개 모두 받음`);
    } else {
      log.push(`${day} 조사 ${done.size}/${goods.length}개 받는 중`);
      break;
    }
  }
  st.finished = [...finished].sort().slice(-6);
  st.checkedAt = new Date().toISOString();
  await query(
    `INSERT INTO ingest_state (job, state, updated_at) VALUES ('goods', $1, now())
     ON CONFLICT (job) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [JSON.stringify(st)],
  );
  // 오래된 원자료는 지운다 (요약은 남김)
  await query(`DELETE FROM goods_prices WHERE survey_day < $1::date - 60`, [latest]);
  const partial = !finished.has(latest) || (!!prev && !finished.has(prev));
  return { rows: saved, message: log.concat(`호출 ${calls}번`).join(", "), partial };
}
