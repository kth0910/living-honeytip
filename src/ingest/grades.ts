// 식품안전나라 Open API C004 음식점 위생등급 지정 현황
// 필드: BSSH_NM 업소명, ADDR 주소, INDUTY_NM 업종, HG_ASGN_LV 등급, HG_ASGN_YMD 지정일,
//       ASGN_FROM/ASGN_TO 유효기간, ASGN_CANCEL_YMD 지정 취소일, CLSBIZ_DVS_CD_NM 영업 상태, CLSBIZ_DT 폐업일,
//       LCNS_NO 인허가번호, HG_ASGN_NO 지정번호, HG_ASGN_NM 지정 기관
import { query } from "../db.js";
import { parseRegion } from "../lib/region.js";
import { parseDate, pick } from "../lib/util.js";
import { fetchPage, makeBizKey } from "./hygiene.js";

const SERVICE = process.env.FOODSAFETY_GRADE_SERVICE || "C004";
const PAGE = 1000;
// 화면에 쓰지 않는 개인정보는 원본 보관에서도 뺀다
const PRIVATE_FIELDS = ["PRSDNT_NM", "TELNO", "WRKR_REG_NO", "RPRSNTV_NM"];

type Row = Record<string, unknown>;

export function gradeRank(level: string | undefined | null): number {
  const t = (level ?? "").replace(/\s+/g, "");
  if (/매우우수/.test(t)) return 3;
  if (/우수/.test(t)) return 2;
  if (/좋음/.test(t)) return 1;
  return 0;
}

export function normalizeGrade(row: Row) {
  const bizName = pick(row, ["BSSH_NM", "PRCSCITYPOINT_BSSHNM"]) ?? "(상호 미상)";
  const addr = pick(row, ["ADDR", "SITE_ADDR"]) ?? null;
  const licenseNo = pick(row, ["LCNS_NO"]) ?? null;
  const grade = pick(row, ["HG_ASGN_LV"]) ?? null;
  const gradeNo = pick(row, ["HG_ASGN_NO"]) ?? `${licenseNo ?? bizName}|${pick(row, ["HG_ASGN_YMD"]) ?? ""}`;
  const { sido, sigungu } = parseRegion(addr);
  const raw: Row = {};
  for (const [k, v] of Object.entries(row)) if (!PRIVATE_FIELDS.includes(k)) raw[k] = v;
  return {
    gradeNo,
    licenseNo,
    bizKey: makeBizKey(bizName, addr, licenseNo),
    bizName,
    bizType: pick(row, ["INDUTY_NM", "INDUTY_CD_NM"]) ?? null,
    addr,
    sido,
    sigungu,
    grade,
    gradeRank: gradeRank(grade),
    assignedOn: parseDate(pick(row, ["HG_ASGN_YMD"])),
    validFrom: parseDate(pick(row, ["ASGN_FROM"])),
    validTo: parseDate(pick(row, ["ASGN_TO"])),
    cancelledOn: parseDate(pick(row, ["ASGN_CANCEL_YMD"])),
    bizStatus: pick(row, ["CLSBIZ_DVS_CD_NM"]) ?? null,
    closedOn: parseDate(pick(row, ["CLSBIZ_DT"])),
    agency: pick(row, ["HG_ASGN_NM"]) ?? null,
    raw,
  };
}

async function upsertGrades(rows: Row[]): Promise<number> {
  const recs = [...new Map(rows.map(normalizeGrade).map((r) => [r.gradeNo, r])).values()];
  for (let i = 0; i < recs.length; i += 500) {
    await query(
      `INSERT INTO hygiene_grades (grade_no, license_no, biz_key, biz_name, biz_type, addr, sido, sigungu, grade,
         grade_rank, assigned_on, valid_from, valid_to, cancelled_on, biz_status, closed_on, agency, raw)
       SELECT "gradeNo", "licenseNo", "bizKey", "bizName", "bizType", addr, sido, sigungu, grade,
         "gradeRank", "assignedOn", "validFrom", "validTo", "cancelledOn", "bizStatus", "closedOn", agency, raw
       FROM jsonb_to_recordset($1::jsonb) AS x(
         "gradeNo" text, "licenseNo" text, "bizKey" text, "bizName" text, "bizType" text, addr text, sido text,
         sigungu text, grade text, "gradeRank" smallint, "assignedOn" date, "validFrom" date, "validTo" date,
         "cancelledOn" date, "bizStatus" text, "closedOn" date, agency text, raw jsonb)
       ON CONFLICT (grade_no) DO UPDATE SET
         license_no = EXCLUDED.license_no, biz_key = EXCLUDED.biz_key, biz_name = EXCLUDED.biz_name,
         biz_type = EXCLUDED.biz_type, addr = EXCLUDED.addr, sido = EXCLUDED.sido, sigungu = EXCLUDED.sigungu,
         grade = EXCLUDED.grade, grade_rank = EXCLUDED.grade_rank, assigned_on = EXCLUDED.assigned_on,
         valid_from = EXCLUDED.valid_from, valid_to = EXCLUDED.valid_to, cancelled_on = EXCLUDED.cancelled_on,
         biz_status = EXCLUDED.biz_status, closed_on = EXCLUDED.closed_on, agency = EXCLUDED.agency,
         raw = EXCLUDED.raw, fetched_at = now()`,
      [JSON.stringify(recs.slice(i, i + 500))],
    );
  }
  return recs.length;
}

type State = { next?: number; total?: number; completedAt?: string };

/** 전체 목록을 1000건씩 받는다. 시간이 모자라면 이어받고, 다 받으면 다음 날 처음부터 다시(등급 변경 반영). */
export async function ingestGrades(opts: { budgetMs?: number } = {}) {
  const deadline = Date.now() + (opts.budgetMs ?? 8 * 60_000);
  const job = `grades_backfill:${SERVICE}`;
  const [row] = await query<{ state: State }>(`SELECT state FROM ingest_state WHERE job = $1`, [job]);
  let st: State = row?.state ?? {};
  if (st.completedAt && Date.now() - Date.parse(st.completedAt) < 20 * 3600_000) {
    return { rows: 0, message: `${SERVICE}: ${st.completedAt.slice(0, 10)}에 이미 모두 받음`, partial: false };
  }
  if (st.completedAt || !st.next) st = { next: 1 };
  let saved = 0;
  while (Date.now() < deadline) {
    const start = st.next ?? 1;
    const { total, rows } = await fetchPage(start, start + PAGE - 1, undefined, SERVICE);
    st.total = total;
    saved += await upsertGrades(rows);
    st.next = start + PAGE;
    if (!rows.length || st.next > total) {
      st = { completedAt: new Date().toISOString(), total };
      break;
    }
    await saveState(job, st);
  }
  await saveState(job, st);
  const done = !!st.completedAt;
  return {
    rows: saved,
    message: done ? `${SERVICE}: 모두 받음 (총 ${st.total}건)` : `${SERVICE}: 받는 중 ${(st.next ?? 1) - 1}/${st.total}`,
    partial: !done,
  };
}

async function saveState(job: string, st: State) {
  await query(
    `INSERT INTO ingest_state (job, state, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (job) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [job, JSON.stringify(st)],
  );
}
