// 식품안전나라 Open API — 행정처분결과 (기본 I0470; 식품접객업 전용 I2630도 같은 필드)
// 요청: {base}/api/{인증키}/{서비스}/json/{시작}/{끝}[/DSPS_DCSNDT=YYYYMMDD]
// 응답: { "{서비스}": { "total_count": "n", "row": [...], "RESULT": { "CODE": "INFO-000", "MSG": "..." } } }
import { query } from "../db.js";
import { parseRegion } from "../lib/region.js";
import { severityOf } from "../lib/severity.js";
import { addDays, compact, fetchWithTimeout, parseDate, pick, redact, sha1, todayKST } from "../lib/util.js";

// 수집할 서비스 (쉼표로 여러 개). I2630 = 식품접객업(식당) 전용, I0470 = 식품업 전체 행정처분.
// 둘 다 같은 필드라 함께 받아 중복을 제거해 저장한다.
const SERVICES = (process.env.FOODSAFETY_SERVICE || "I2630,I0470").split(",").map((s) => s.trim()).filter(Boolean);
const SERVICE = SERVICES[0];
const PAGE = 1000; // API 1회 최대 행 수

type Row = Record<string, unknown>;

export class FoodSafetyError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function base(): string {
  return (process.env.FOODSAFETY_API_BASE || "http://openapi.foodsafetykorea.go.kr").replace(/\/$/, "");
}

function apiKey(): string {
  const key = process.env.FOODSAFTYKOREA_OPEN_API;
  if (!key) throw new FoodSafetyError("NO_KEY", "FOODSAFTYKOREA_OPEN_API 환경변수가 없습니다");
  return key;
}

export async function fetchPage(
  start: number,
  end: number,
  filter?: string,
  service: string = SERVICE,
): Promise<{ total: number; rows: Row[] }> {
  const url = `${base()}/api/${encodeURIComponent(apiKey())}/${service}/json/${start}/${end}${filter ? `/${filter}` : ""}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(url, 60_000);
      const text = await res.text();
      if (!res.ok) throw new FoodSafetyError(`HTTP-${res.status}`, text.slice(0, 200));
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        throw new FoodSafetyError("BAD_JSON", text.slice(0, 200));
      }
      const body = json[service] ?? json;
      const result = body?.RESULT ?? json?.RESULT;
      const code: string = result?.CODE ?? "INFO-000";
      if (code === "INFO-200") return { total: 0, rows: [] }; // 데이터 없음
      if (code !== "INFO-000") throw new FoodSafetyError(code, result?.MSG ?? "API 오류");
      const rows: Row[] = Array.isArray(body?.row) ? body.row : body?.row ? [body.row] : [];
      return { total: Number(body?.total_count ?? rows.length) || rows.length, rows };
    } catch (err) {
      lastErr = err;
      // 인증/신청 오류는 재시도해도 같은 결과
      if (err instanceof FoodSafetyError && /^INFO-(100|110|300|400)$/.test(err.code)) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const code = lastErr instanceof FoodSafetyError ? lastErr.code : "NETWORK";
  throw new FoodSafetyError(code, redact(msg));
}

export function normalizeRow(row: Row) {
  const bizName = pick(row, ["PRCSCITYPOINT_BSSHNM", "BSSH_NM", "BSSHNM"]) ?? "(상호 미상)";
  const addr = pick(row, ["ADDR", "SITE_ADDR", "LOCPLC"]) ?? null;
  const bizType = pick(row, ["INDUTY_CD_NM", "INDUTY_NM", "BSN_SE_NM"]) ?? null;
  const actionDate = parseDate(pick(row, ["DSPS_DCSNDT", "DSPS_DT", "DSPS_BGNDT"]));
  const actionType = pick(row, ["DSPS_TYPECD_NM", "DSPS_TYPE_NM", "DSPS_TYPECD"]) ?? null;
  const violation = pick(row, ["VILTCN", "VIOL_CN", "VILT_CN"]) ?? null;
  const detailParts = [
    pick(row, ["DSPSCN", "DSPS_CN"]),
    (() => {
      const b = parseDate(pick(row, ["DSPS_BGNDT"]));
      const e = parseDate(pick(row, ["DSPS_ENDDT"]));
      return b && e ? `${b} ~ ${e}` : undefined;
    })(),
  ].filter(Boolean);
  const law = pick(row, ["LAWORD_CD_NM", "LAWORD_NM", "VILT_LAWORD"]) ?? null;
  const licenseNo = pick(row, ["LCNS_NO", "PRMS_NO"]) ?? null;
  const { sido, sigungu } = parseRegion(addr);
  const nameNorm = bizName.replace(/\s+/g, "").toLowerCase();
  const addrNorm = (addr ?? "").replace(/\s+/g, "");
  const bizKey = sha1(licenseNo ? `lic:${licenseNo}` : `${nameNorm}|${addrNorm}`).slice(0, 16);
  const sourceKey = sha1(JSON.stringify([nameNorm, addrNorm, actionDate, actionType, violation, licenseNo]));
  return {
    sourceKey,
    bizKey,
    bizName,
    bizType,
    addr,
    sido,
    sigungu,
    actionDate,
    actionType,
    severity: severityOf(actionType ?? undefined, detailParts.join(" "), violation ?? undefined),
    violation,
    actionDetail: detailParts.join(" · ") || null,
    law,
    licenseNo,
    raw: row,
  };
}

export async function upsertRows(rows: Row[]): Promise<number> {
  if (!rows.length) return 0;
  const n = rows.map(normalizeRow);
  // 한 번에 같은 키가 두 번 들어오면 ON CONFLICT 오류가 나므로 미리 제거
  const uniq = [...new Map(n.map((r) => [r.sourceKey, r])).values()];
  let inserted = 0;
  for (let i = 0; i < uniq.length; i += 500) {
    const chunk = uniq.slice(i, i + 500);
    const res = await query<{ inserted: number }>(
      `WITH input AS (
         SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(
           "sourceKey" text, "bizKey" text, "bizName" text, "bizType" text, addr text,
           sido text, sigungu text, "actionDate" date, "actionType" text, severity smallint,
           violation text, "actionDetail" text, law text, "licenseNo" text, raw jsonb)
       ), ins AS (
         INSERT INTO hygiene_actions
           (source_key, biz_key, biz_name, biz_type, addr, sido, sigungu, action_date, action_type,
            severity, violation, action_detail, law, license_no, raw)
         SELECT "sourceKey", "bizKey", "bizName", "bizType", addr, sido, sigungu, "actionDate", "actionType",
                severity, violation, "actionDetail", law, "licenseNo", raw FROM input
         ON CONFLICT (source_key) DO UPDATE SET
           severity = EXCLUDED.severity, biz_type = EXCLUDED.biz_type, sido = EXCLUDED.sido,
           sigungu = EXCLUDED.sigungu, action_detail = EXCLUDED.action_detail, law = EXCLUDED.law,
           raw = EXCLUDED.raw, fetched_at = now()
         RETURNING (xmax = 0) AS is_new
       )
       SELECT count(*) FILTER (WHERE is_new)::int AS inserted FROM ins`,
      [JSON.stringify(chunk)],
    );
    inserted += res[0]?.inserted ?? 0;
  }
  return inserted;
}

type BackfillState = { next?: number; total?: number; completedAt?: string; startedAt?: string };

/**
 * 서비스마다
 * 1) 최근 며칠치 처분을 날짜 필터로 먼저 가져오고
 * 2) 남은 시간 동안 전체 목록을 1000건씩 이어서 훑는다(중단 지점 저장 → 다음 실행에서 계속).
 *    한 바퀴를 다 돌면 7일 뒤 다시 처음부터 돈다(수정·삭제 반영).
 * 활용신청이 안 된 서비스(INFO-110)는 건너뛰고, 모든 서비스가 안 될 때만 실패로 본다.
 */
export async function ingestHygiene(opts: { budgetMs?: number; recentDays?: number } = {}) {
  const deadline = Date.now() + (opts.budgetMs ?? 8 * 60_000);
  const log: string[] = [];
  let inserted = 0;
  let fetched = 0;
  let partial = false;
  let usable = 0;
  let lastFatal: FoodSafetyError | undefined;
  for (const svc of SERVICES) {
    try {
      const r = await ingestService(svc, deadline, opts.recentDays ?? 10);
      inserted += r.inserted;
      fetched += r.fetched;
      partial ||= r.partial;
      usable++;
      log.push(`${svc}: ${r.log.join(", ") || "ok"}`);
    } catch (err) {
      if (err instanceof FoodSafetyError && /^(INFO-(100|110)|NO_KEY)$/.test(err.code)) {
        lastFatal = err;
        log.push(`${svc}: ${err.code} 사용 불가`);
        continue;
      }
      throw err;
    }
  }
  if (!usable && lastFatal) throw lastFatal;
  return { rows: inserted, fetched, message: log.join(" · ") || "ok", partial };
}

async function ingestService(svc: string, deadline: number, recentDays: number) {
  const log: string[] = [];
  let inserted = 0;
  let fetched = 0;

  // 1) 최근 처분 (오늘 자료는 19시 이후에만 열리므로 그런 날은 건너뛴다)
  const today = todayKST();
  let filterWorks = true;
  for (let i = 0; i < recentDays && Date.now() < deadline && filterWorks; i++) {
    const day = compact(addDays(today, -i));
    try {
      const { rows } = await fetchPage(1, PAGE, `DSPS_DCSNDT=${day}`, svc);
      fetched += rows.length;
      if (rows.length && rows.every((r) => compact(normalizeRow(r).actionDate ?? "") !== day)) {
        filterWorks = false;
        log.push("날짜 필터 미지원 — 전체 순회로만 수집");
      }
      inserted += await upsertRows(rows);
    } catch (err) {
      if (err instanceof FoodSafetyError && /^(INFO-(100|110)|NO_KEY)$/.test(err.code)) throw err;
      if (/19시 이후/.test((err as Error).message)) continue;
      log.push(`최근 ${day}: ${(err as Error).message}`);
      break;
    }
  }

  // 2) 전체 순회 (이어받기)
  const job = `hygiene_backfill:${svc}`;
  const [stRow] = await query<{ state: BackfillState }>(`SELECT state FROM ingest_state WHERE job = $1`, [job]);
  let st: BackfillState = stRow?.state ?? {};
  if (st.completedAt && Date.now() - Date.parse(st.completedAt) < 7 * 86400_000) {
    log.push(`전체 순회 ${st.completedAt.slice(0, 10)} 완료`);
  } else {
    if (st.completedAt || !st.next) st = { next: 1, startedAt: new Date().toISOString() };
    while (Date.now() < deadline) {
      const start = st.next ?? 1;
      const { total, rows } = await fetchPage(start, start + PAGE - 1, undefined, svc);
      fetched += rows.length;
      st.total = total;
      inserted += await upsertRows(rows);
      st.next = start + PAGE;
      if (!rows.length || st.next > total) {
        st = { completedAt: new Date().toISOString(), total };
        log.push(`전체 순회 완료 (총 ${total}건)`);
        break;
      }
      await saveState(job, st);
    }
    await saveState(job, st);
    if (!st.completedAt) log.push(`전체 순회 진행 중 ${st.next! - 1}/${st.total}`);
  }
  return { inserted, fetched, log, partial: !st.completedAt };
}

async function saveState(job: string, st: BackfillState) {
  await query(
    `INSERT INTO ingest_state (job, state, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (job) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [job, JSON.stringify(st)],
  );
}
