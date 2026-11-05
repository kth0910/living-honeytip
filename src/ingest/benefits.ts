// 행정안전부 대한민국 공공서비스(혜택) 정보 (공공데이터포털 15113968, api.odcloud.kr)
//   GET {base}/serviceList?page=&perPage=&serviceKey=     서비스 목록(이름, 지원 내용, 대상, 기관, 조회수 ...)
//   GET {base}/supportConditions?page=&perPage=&serviceKey= 지원 조건 코드(연령 JA0110~JA0111 등)
import { query } from "../db.js";
import { applyEnd } from "../lib/apply-period.js";
import { normalizeSido, parseRegion } from "../lib/region.js";
import { fetchWithTimeout, redact } from "../lib/util.js";

type Row = Record<string, any>;
const PER_PAGE = 500;

function base(): string {
  return (process.env.BENEFITS_API_BASE || "https://api.odcloud.kr/api/gov24/v3").replace(/\/$/, "");
}

function keyParam(): string {
  const key = process.env.DATAKR_API_KEY;
  if (!key) throw new Error("NO_KEY DATAKR_API_KEY 환경변수가 없습니다");
  return /%[0-9A-F]{2}/i.test(key) ? key : encodeURIComponent(key);
}

async function fetchList(path: string, page: number): Promise<{ total: number; data: Row[] }> {
  const url = `${base()}/${path}?page=${page}&perPage=${PER_PAGE}&serviceKey=${keyParam()}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetchWithTimeout(url, 60_000);
      const text = await res.text();
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error(`AUTH ${res.status}`), { fatal: true });
      if (!res.ok) throw new Error(`HTTP-${res.status} ${text.slice(0, 120)}`);
      const json = JSON.parse(text);
      return { total: Number(json.totalCount ?? json.matchCount ?? 0), data: Array.isArray(json.data) ? json.data : [] };
    } catch (err) {
      lastErr = err;
      if ((err as any)?.fatal) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error(redact((lastErr as Error)?.message ?? String(lastErr)));
}

function ts(v: unknown): string | null {
  const d = String(v ?? "").replace(/[^0-9]/g, "");
  if (d.length < 8) return null;
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(8, 10) || "00"}:${d.slice(10, 12) || "00"}:${d.slice(12, 14) || "00"}+09:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** 담당 기관 이름으로 지역을 정한다. 지자체가 아닌 곳(중앙부처, 공공기관)은 전국. */
export function agencyRegion(name: string | null | undefined, type: string | null | undefined) {
  if (!name) return { sido: null, sigungu: null };
  if (type && !/지방|지자체|자치/.test(type) && !normalizeSido(name.split(/\s+/)[0])) return { sido: null, sigungu: null };
  const r = parseRegion(name);
  return r.sido ? r : { sido: null, sigungu: null };
}

const str = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);

export function normalizeBenefit(row: Row, cond?: Row) {
  const agency = str(row["소관기관명"]);
  const agencyType = str(row["소관기관유형"]);
  const { sido, sigungu } = agencyRegion(agency, agencyType);
  const ageMin = cond && typeof cond.JA0110 === "number" ? cond.JA0110 : null;
  const ageMax = cond && typeof cond.JA0111 === "number" ? cond.JA0111 : null;
  return {
    id: String(row["서비스ID"]),
    name: str(row["서비스명"]) ?? "(이름 없음)",
    summary: str(row["서비스목적요약"]),
    field: str(row["서비스분야"]),
    userType: str(row["사용자구분"]),
    supportType: str(row["지원유형"]),
    agency,
    agencyType,
    dept: str(row["부서명"]),
    target: str(row["지원대상"]),
    criteria: str(row["선정기준"]),
    content: str(row["지원내용"]),
    applyMethod: str(row["신청방법"]),
    deadline: str(row["신청기한"]),
    applyEnd: applyEnd(str(row["신청기한"])),
    receiver: str(row["접수기관"]),
    contact: str(row["전화문의"]),
    url: str(row["상세조회URL"]),
    views: Number(row["조회수"]) || 0,
    registeredAt: ts(row["등록일시"]),
    modifiedAt: ts(row["수정일시"]),
    ageMin,
    ageMax,
    sido,
    sigungu,
    conditions: cond ?? null,
    raw: row,
  };
}

async function upsert(recs: ReturnType<typeof normalizeBenefit>[]): Promise<number> {
  for (let i = 0; i < recs.length; i += 300) {
    await query(
      `INSERT INTO benefits (id, name, summary, field, user_type, support_type, agency, agency_type, dept, target,
         criteria, content, apply_method, deadline, receiver, contact, url, views, registered_at, modified_at,
         age_min, age_max, sido, sigungu, conditions, raw, apply_end)
       SELECT id, name, summary, field, "userType", "supportType", agency, "agencyType", dept, target,
         criteria, content, "applyMethod", deadline, receiver, contact, url, views, "registeredAt", "modifiedAt",
         "ageMin", "ageMax", sido, sigungu, conditions, raw, "applyEnd"
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text, name text, summary text, field text, "userType" text, "supportType" text, agency text,
         "agencyType" text, dept text, target text, criteria text, content text, "applyMethod" text, deadline text,
         receiver text, contact text, url text, views int, "registeredAt" timestamptz, "modifiedAt" timestamptz,
         "ageMin" int, "ageMax" int, sido text, sigungu text, conditions jsonb, raw jsonb, "applyEnd" date)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, summary = EXCLUDED.summary, field = EXCLUDED.field, user_type = EXCLUDED.user_type,
         support_type = EXCLUDED.support_type, agency = EXCLUDED.agency, agency_type = EXCLUDED.agency_type,
         dept = EXCLUDED.dept, target = EXCLUDED.target, criteria = EXCLUDED.criteria, content = EXCLUDED.content,
         apply_method = EXCLUDED.apply_method, deadline = EXCLUDED.deadline, receiver = EXCLUDED.receiver,
         contact = EXCLUDED.contact, url = EXCLUDED.url, views = EXCLUDED.views,
         registered_at = EXCLUDED.registered_at, modified_at = EXCLUDED.modified_at,
         age_min = EXCLUDED.age_min, age_max = EXCLUDED.age_max, sido = EXCLUDED.sido, sigungu = EXCLUDED.sigungu,
         conditions = EXCLUDED.conditions, raw = EXCLUDED.raw, apply_end = EXCLUDED.apply_end, seen_at = now()`,
      [JSON.stringify(recs.slice(i, i + 300))],
    );
  }
  return recs.length;
}

/** 목록과 지원 조건을 모두 받아 합친다. 이번에 보이지 않은 혜택은 끝난 것으로 표시한다. */
export async function ingestBenefits(opts: { budgetMs?: number } = {}) {
  const deadline = Date.now() + (opts.budgetMs ?? 8 * 60_000);
  const started = new Date().toISOString();
  const conds = new Map<string, Row>();
  for (let page = 1; ; page++) {
    const { total, data } = await fetchList("supportConditions", page);
    for (const c of data) conds.set(String(c["서비스ID"]), c);
    if (!data.length || page * PER_PAGE >= total || Date.now() > deadline) break;
  }
  let saved = 0;
  let total = 0;
  let complete = false;
  for (let page = 1; Date.now() < deadline; page++) {
    const r = await fetchList("serviceList", page);
    total = r.total;
    saved += await upsert(r.data.map((row) => normalizeBenefit(row, conds.get(String(row["서비스ID"])))));
    if (!r.data.length || page * PER_PAGE >= total) {
      complete = true;
      break;
    }
  }
  if (complete && saved > total * 0.9) {
    await query(`UPDATE benefits SET ended_at = now() WHERE seen_at < $1 AND ended_at IS NULL`, [started]);
    await query(`UPDATE benefits SET ended_at = NULL WHERE seen_at >= $1`, [started]);
  }
  return { rows: saved, message: `혜택 ${saved}/${total}건, 조건 ${conds.size}건`, partial: !complete };
}
