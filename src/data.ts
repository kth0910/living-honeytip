import { query } from "./db.js";
import { addDays } from "./lib/util.js";
import { EAT_TYPES } from "./lib/severity.js";

/* ----------------------------- 공통 ----------------------------- */

export type RunInfo = { job: string; status: string; finished_at: string | null; started_at: string; rows: number; message: string | null };

export async function lastRuns(): Promise<Record<string, { lastOk?: RunInfo; last?: RunInfo }>> {
  const rows = await query<RunInfo & { kind: string }>(
    `(SELECT DISTINCT ON (job) 'last' AS kind, job, status, finished_at, started_at, rows, message
        FROM ingest_runs ORDER BY job, started_at DESC)
     UNION ALL
     (SELECT DISTINCT ON (job) 'lastOk' AS kind, job, status, finished_at, started_at, rows, message
        FROM ingest_runs WHERE status IN ('ok','partial') ORDER BY job, started_at DESC)`,
  );
  const out: Record<string, { lastOk?: RunInfo; last?: RunInfo }> = {};
  for (const r of rows) (out[r.job] ??= {})[r.kind as "last" | "lastOk"] = r;
  return out;
}

/* ----------------------------- 위생 ----------------------------- */

export type RegionCount = { sido: string; sigungu: string | null; n: number };

export async function hygieneRegions(): Promise<RegionCount[]> {
  return query<RegionCount>(
    `SELECT sido, sigungu, count(DISTINCT biz_key)::int AS n
       FROM (SELECT sido, sigungu, biz_key FROM hygiene_actions WHERE sido IS NOT NULL
             UNION ALL
             SELECT sido, sigungu, biz_key FROM hygiene_grades WHERE sido IS NOT NULL) t
      GROUP BY sido, sigungu ORDER BY sido, sigungu NULLS FIRST`,
  );
}

/* ----------------------------- 위생등급 ----------------------------- */

/** 지금 유효한 위생등급: 취소되지 않았고, 기간 안이고, 폐업하지 않은 곳 */
export function activeGrade(alias = ""): string {
  const a = alias ? `${alias}.` : "";
  return `${a}cancelled_on IS NULL AND (${a}valid_to IS NULL OR ${a}valid_to >= current_date)
    AND coalesce(${a}biz_status, '') NOT LIKE '폐업%'`;
}

export type GradeRow = {
  biz_key: string;
  biz_name: string;
  biz_type: string | null;
  addr: string | null;
  grade: string | null;
  grade_rank: number;
  assigned_on: string | null;
  valid_to: string | null;
  cancelled_on: string | null;
  biz_status: string | null;
  closed_on: string | null;
};

function gradeWhere(f: { q?: string; sido?: string | null; sigungu?: string | null }, params: unknown[]): string {
  const where: string[] = [activeGrade()];
  for (const t of (f.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5)) {
    params.push(`%${t.replace(/[\\%_]/g, (m) => "\\" + m)}%`);
    where.push(`(biz_name ILIKE $${params.length} OR addr ILIKE $${params.length})`);
  }
  if (f.sido) {
    params.push(f.sido);
    where.push(`sido = $${params.length}`);
  }
  if (f.sigungu) {
    params.push(f.sigungu);
    where.push(`sigungu = $${params.length}`);
  }
  return where.join(" AND ");
}

export async function searchGrades(f: {
  q?: string;
  sido?: string | null;
  sigungu?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<{ items: GradeRow[]; total: number }> {
  const params: unknown[] = [];
  const where = gradeWhere(f, params);
  const pageSize = f.pageSize ?? 20;
  params.push(pageSize, ((f.page ?? 1) - 1) * pageSize);
  const rows = await query<GradeRow & { total: number }>(
    `WITH g AS (
       SELECT DISTINCT ON (biz_key) biz_key, biz_name, biz_type, addr, grade, grade_rank, assigned_on, valid_to,
              cancelled_on, biz_status, closed_on
         FROM hygiene_grades WHERE ${where}
        ORDER BY biz_key, assigned_on DESC NULLS LAST
     )
     SELECT g.*, count(*) OVER ()::int AS total FROM g
      ORDER BY grade_rank DESC, assigned_on DESC NULLS LAST, biz_name
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: rows, total: rows[0]?.total ?? 0 };
}

export async function gradeStats(f: { sido?: string | null; sigungu?: string | null }) {
  const params: unknown[] = [];
  const where = gradeWhere(f, params);
  const [r] = await query<{ active: number; recent30: number; expiring: number }>(
    `SELECT count(DISTINCT biz_key)::int AS active,
            count(DISTINCT biz_key) FILTER (WHERE assigned_on >= current_date - 30)::int AS recent30,
            count(DISTINCT biz_key) FILTER (WHERE valid_to < current_date + 60)::int AS expiring
       FROM hygiene_grades WHERE ${where}`,
    params,
  );
  return r ?? { active: 0, recent30: 0, expiring: 0 };
}

export async function gradesForBiz(bizKey: string): Promise<GradeRow[]> {
  return query<GradeRow>(
    `SELECT biz_key, biz_name, biz_type, addr, grade, grade_rank, assigned_on, valid_to, cancelled_on, biz_status, closed_on
       FROM hygiene_grades WHERE biz_key = $1 ORDER BY assigned_on DESC NULLS LAST`,
    [bizKey],
  );
}

export type BizSummary = {
  biz_key: string;
  biz_name: string;
  biz_type: string | null;
  addr: string | null;
  actions: number;
  max_severity: number;
  last_date: string | null;
  last_type: string | null;
  last_violation: string | null;
  has_grade?: boolean;
};

export type HygieneFilter = {
  q?: string;
  sido?: string | null;
  sigungu?: string | null;
  minSeverity?: number;
  sinceDays?: number | null;
  /** true면 식당, 카페(EAT_TYPES)만 */
  eatOnly?: boolean;
  page?: number;
  pageSize?: number;
};

function hygieneWhere(f: HygieneFilter, params: unknown[]): string {
  const where: string[] = ["TRUE"];
  const tokens = (f.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  for (const t of tokens) {
    params.push(`%${t.replace(/[\\%_]/g, (m) => "\\" + m)}%`);
    where.push(`(biz_name ILIKE $${params.length} OR addr ILIKE $${params.length})`);
  }
  if (f.sido) {
    params.push(f.sido);
    where.push(`sido = $${params.length}`);
  }
  if (f.sigungu) {
    params.push(f.sigungu);
    where.push(`sigungu = $${params.length}`);
  }
  if (f.sinceDays) {
    params.push(f.sinceDays);
    where.push(`action_date >= current_date - $${params.length}::int`);
  }
  if (f.eatOnly) {
    params.push(EAT_TYPES);
    where.push(`biz_type = ANY($${params.length}::text[])`);
  }
  return where.join(" AND ");
}

export async function searchBusinesses(f: HygieneFilter): Promise<{ items: BizSummary[]; total: number }> {
  const params: unknown[] = [];
  const where = hygieneWhere(f, params);
  const pageSize = f.pageSize ?? 20;
  const offset = ((f.page ?? 1) - 1) * pageSize;
  const minSev = f.minSeverity ?? 1;
  params.push(minSev, pageSize, offset);
  const [ps, pl, po] = [params.length - 2, params.length - 1, params.length];
  const rows = await query<BizSummary & { total: number }>(
    `WITH matched AS (SELECT * FROM hygiene_actions WHERE ${where}),
     biz AS (
       SELECT biz_key,
              count(*)::int AS actions,
              max(severity)::int AS max_severity,
              max(action_date) AS last_date
         FROM matched GROUP BY biz_key
       HAVING max(severity) >= $${ps}
     ),
     latest AS (
       SELECT DISTINCT ON (biz_key) biz_key, biz_name, biz_type, addr, action_type AS last_type, violation AS last_violation
         FROM matched ORDER BY biz_key, action_date DESC NULLS LAST, severity DESC
     )
     SELECT b.*, l.biz_name, l.biz_type, l.addr, l.last_type, l.last_violation, count(*) OVER ()::int AS total,
            EXISTS (SELECT 1 FROM hygiene_grades g WHERE g.biz_key = b.biz_key AND ${activeGrade("g")}) AS has_grade
       FROM biz b JOIN latest l USING (biz_key)
      ORDER BY b.last_date DESC NULLS LAST, b.max_severity DESC, l.biz_name
      LIMIT $${pl} OFFSET $${po}`,
    params,
  );
  return { items: rows, total: rows[0]?.total ?? 0 };
}

export type HygieneStats = {
  businesses: number; // 위생 관련 처분(심각도 1 이상)을 받은 업소
  actions: number;
  severe: number; // 영업정지 이상을 받은 업소
  recent30: number; // 최근 30일 안에 새로 처분받은 업소
  closed: number; // 영업취소, 폐쇄된 업소
  adminClosed: number; // 폐업 정리(위생 무관)로만 기록된 업소
};

export async function hygieneStats(f: HygieneFilter): Promise<HygieneStats & { violations: string[] }> {
  const params: unknown[] = [];
  const where = hygieneWhere(f, params);
  const [s] = await query<HygieneStats>(
    `SELECT count(DISTINCT biz_key) FILTER (WHERE severity >= 1)::int AS businesses,
            count(*) FILTER (WHERE severity >= 1)::int AS actions,
            count(DISTINCT biz_key) FILTER (WHERE severity >= 2)::int AS severe,
            count(DISTINCT biz_key) FILTER (WHERE severity >= 1 AND action_date >= current_date - 30)::int AS "recent30",
            count(DISTINCT biz_key) FILTER (WHERE severity >= 3)::int AS closed,
            count(DISTINCT biz_key) FILTER (WHERE severity = 0)::int AS "adminClosed"
       FROM hygiene_actions WHERE ${where}`,
    params,
  );
  const v = await query<{ violation: string }>(
    `SELECT violation FROM hygiene_actions WHERE ${where} AND violation IS NOT NULL AND severity >= 1
      ORDER BY action_date DESC NULLS LAST LIMIT 500`,
    params,
  );
  return {
    ...(s ?? { businesses: 0, actions: 0, severe: 0, recent30: 0, closed: 0, adminClosed: 0 }),
    violations: v.map((r) => r.violation),
  };
}

export type ActionRow = {
  id: number;
  biz_key: string;
  biz_name: string;
  biz_type: string | null;
  addr: string | null;
  sido: string | null;
  sigungu: string | null;
  action_date: string | null;
  action_type: string | null;
  severity: number;
  violation: string | null;
  action_detail: string | null;
  period_start: string | null;
  period_end: string | null;
  law: string | null;
};

export async function businessActions(bizKey: string): Promise<ActionRow[]> {
  return query<ActionRow>(
    `SELECT id, biz_key, biz_name, biz_type, addr, sido, sigungu, action_date, action_type, severity,
            violation, action_detail, period_start, period_end, law
       FROM hygiene_actions WHERE biz_key = $1
      ORDER BY action_date DESC NULLS LAST, id DESC`,
    [bizKey],
  );
}

/* ----------------------------- 가격 ----------------------------- */

export type PriceRow = {
  key: string;
  category_code: string;
  category_name: string;
  item_code: string;
  item_name: string;
  kind_code: string;
  kind_name: string;
  rank_code: string;
  rank_name: string;
  unit: string;
  price: number;
  p1w: number | null;
  p1m: number | null;
  p1y: number | null;
  normal: number | null;
  samples: number;
  survey_date: string;
};

export async function priceRegions(date: string): Promise<{ region_code: string; region_name: string; n: number }[]> {
  return query(
    `SELECT region_code, region_name, count(*)::int AS n FROM price_daily
      WHERE survey_date = $1 GROUP BY region_code, region_name
      ORDER BY (region_code = '0000') DESC, region_name`,
    [date],
  );
}

/**
 * 기준 조사일: 주말, 공휴일엔 일부 품목만 조사되므로, 최근 3주 중 가장 많이 조사된 날의
 * 60% 이상 품목이 있는 가장 최근 날짜를 쓴다.
 */
export async function latestPriceDate(region = "0000"): Promise<string | null> {
  const [r] = await query<{ d: string | null }>(
    `WITH recent AS (
       SELECT survey_date, count(*) AS n FROM price_daily
        WHERE region_code = $1
          AND survey_date >= (SELECT max(survey_date) FROM price_daily WHERE region_code = $1) - 21
        GROUP BY survey_date
     )
     SELECT max(survey_date) AS d FROM recent WHERE n >= 0.6 * (SELECT max(n) FROM recent)`,
    [region],
  );
  return r?.d ?? null;
}

/** 같은 품목, 품종, 단위에서 '상품' 등급을 우선해 한 줄씩, 비교 가격과 함께 */
export async function priceList(region: string, date: string): Promise<PriceRow[]> {
  return query<PriceRow>(
    `WITH cur AS (
       SELECT DISTINCT ON (item_code, kind_code, unit) *
         FROM price_daily
        WHERE region_code = $1 AND survey_date = $2
        ORDER BY item_code, kind_code, unit, (rank_name LIKE '상품%' OR rank_code = '04') DESC, rank_code
     )
     SELECT concat_ws('~', c.item_code, c.kind_code, c.rank_code, c.unit) AS key,
            c.category_code, c.category_name, c.item_code, c.item_name, c.kind_code, c.kind_name,
            c.rank_code, c.rank_name, c.unit, c.price, c.samples, c.survey_date,
            coalesce(c.price_1w, w.price) AS p1w,
            coalesce(c.price_1m, m.price) AS p1m,
            coalesce(c.price_1y, y.price) AS p1y,
            c.price_normal AS normal
       FROM cur c
       LEFT JOIN LATERAL (
         SELECT price FROM price_daily p
          WHERE p.region_code = c.region_code AND p.item_code = c.item_code AND p.kind_code = c.kind_code
            AND p.rank_code = c.rank_code AND p.unit = c.unit
            AND p.survey_date BETWEEN c.survey_date - 10 AND c.survey_date - 4
          ORDER BY abs((c.survey_date - 7) - p.survey_date) LIMIT 1) w ON true
       LEFT JOIN LATERAL (
         SELECT price FROM price_daily p
          WHERE p.region_code = c.region_code AND p.item_code = c.item_code AND p.kind_code = c.kind_code
            AND p.rank_code = c.rank_code AND p.unit = c.unit
            AND p.survey_date BETWEEN c.survey_date - 35 AND c.survey_date - 25
          ORDER BY abs((c.survey_date - 30) - p.survey_date) LIMIT 1) m ON true
       LEFT JOIN LATERAL (
         SELECT price FROM price_daily p
          WHERE p.region_code = c.region_code AND p.item_code = c.item_code AND p.kind_code = c.kind_code
            AND p.rank_code = c.rank_code AND p.unit = c.unit
            AND p.survey_date BETWEEN c.survey_date - 372 AND c.survey_date - 358
          ORDER BY abs((c.survey_date - 365) - p.survey_date) LIMIT 1) y ON true
      ORDER BY c.category_code, c.item_name, c.kind_name`,
    [region, date],
  );
}

export type HistoryPoint = { d: string; price: number };

export async function priceHistory(
  region: string,
  k: { item_code: string; kind_code: string; rank_code: string; unit: string },
  since: string,
): Promise<HistoryPoint[]> {
  return query<HistoryPoint>(
    `SELECT survey_date AS d, price FROM price_daily
      WHERE region_code = $1 AND item_code = $2 AND kind_code = $3 AND rank_code = $4 AND unit = $5
        AND survey_date >= $6
      ORDER BY survey_date`,
    [region, k.item_code, k.kind_code, k.rank_code, k.unit, since],
  );
}

export async function priceByRegion(
  date: string,
  k: { item_code: string; kind_code: string; rank_code: string; unit: string },
): Promise<{ region_code: string; region_name: string; price: number }[]> {
  return query(
    `SELECT region_code, region_name, price FROM price_daily
      WHERE survey_date = $1 AND item_code = $2 AND kind_code = $3 AND rank_code = $4 AND unit = $5
        AND region_code <> '0000'
      ORDER BY price`,
    [date, k.item_code, k.kind_code, k.rank_code, k.unit],
  );
}

export function weeklyChange(r: Pick<PriceRow, "price" | "p1w">): number | null {
  return r.p1w ? (r.price - r.p1w) / r.p1w : null;
}

export function sinceForHistory(date: string): string {
  return addDays(date, -400);
}
