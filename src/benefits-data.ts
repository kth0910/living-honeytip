// 공공서비스(혜택) 조회
import { query } from "./db.js";

export type BenefitRow = {
  id: string;
  name: string;
  summary: string | null;
  field: string | null;
  user_type: string | null;
  support_type: string | null;
  agency: string | null;
  agency_type: string | null;
  views: number;
  registered_at: string | null;
  sido: string | null;
  sigungu: string | null;
  age_min: number | null;
  age_max: number | null;
  /** 신청이 끝나는 날 (YYYY-MM-DD). 모르거나 열려 있으면 null */
  apply_end: string | null;
  /** 끝나는 날까지 남은 날 (지났으면 음수) */
  days_left: number | null;
};

export type BenefitDetail = BenefitRow & {
  dept: string | null;
  target: string | null;
  criteria: string | null;
  content: string | null;
  apply_method: string | null;
  deadline: string | null;
  receiver: string | null;
  contact: string | null;
  url: string | null;
  modified_at: string | null;
};

export type BenefitFilter = {
  q?: string;
  sido?: string | null;
  sigungu?: string | null;
  /** true면 그 지자체 혜택만, false면 전국 혜택 + 그 지역 혜택 */
  localOnly?: boolean;
  age?: number | null;
  field?: string | null;
  who?: string | null; // 개인 | 가구 | 소상공인
  newDays?: number | null;
  /** 신청 기간이 끝난 혜택: 빼기(기본), 함께, 그것만 */
  ended?: "hide" | "include" | "only";
  sort?: "views" | "new";
  page?: number;
  pageSize?: number;
};

/** 한국 날짜 기준 오늘 */
const TODAY = `(now() AT TIME ZONE 'Asia/Seoul')::date`;

const COLS = `id, name, summary, field, user_type, support_type, agency, agency_type, views,
  to_char(registered_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS registered_at, sido, sigungu, age_min, age_max,
  to_char(apply_end, 'YYYY-MM-DD') AS apply_end, (apply_end - ${TODAY})::int AS days_left`;

function where(f: BenefitFilter, params: unknown[]): string {
  const w: string[] = ["ended_at IS NULL"];
  const ended = f.ended ?? "hide";
  if (ended === "hide") w.push(`(apply_end IS NULL OR apply_end >= ${TODAY})`);
  else if (ended === "only") w.push(`apply_end < ${TODAY}`);
  for (const t of (f.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5)) {
    params.push(`%${t.replace(/[\\%_]/g, (m) => "\\" + m)}%`);
    const i = params.length;
    w.push(`(name ILIKE $${i} OR summary ILIKE $${i} OR target ILIKE $${i} OR agency ILIKE $${i})`);
  }
  if (f.sido) {
    params.push(f.sido);
    const s = params.length;
    let local = `(sido = $${s} AND sigungu IS NULL)`;
    if (f.sigungu) {
      params.push(f.sigungu);
      local = `(sido = $${s} AND (sigungu IS NULL OR sigungu = $${params.length}))`;
    } else {
      local = `(sido = $${s})`;
    }
    w.push(f.localOnly ? local : `(sido IS NULL OR ${local})`);
  } else if (f.localOnly) {
    w.push("FALSE");
  }
  if (f.age !== null && f.age !== undefined && Number.isFinite(f.age)) {
    // 나이는 10살 단위(30대 = 30~39세). 혜택 나이 범위가 그 구간과 겹치면 보여 준다.
    const lo = Math.min(70, Math.floor(f.age / 10) * 10);
    const hi = lo >= 70 ? 150 : lo + 9;
    params.push(lo, hi);
    w.push(`(age_min IS NULL OR age_min <= $${params.length}) AND (age_max IS NULL OR age_max >= $${params.length - 1})`);
  }
  if (f.field) {
    params.push(f.field);
    w.push(`field = $${params.length}`);
  }
  if (f.who) {
    params.push(`%${f.who}%`);
    w.push(`user_type LIKE $${params.length}`);
  }
  if (f.newDays) {
    params.push(f.newDays);
    w.push(`registered_at >= now() - ($${params.length} || ' days')::interval`);
  }
  return w.join(" AND ");
}

export async function searchBenefits(f: BenefitFilter): Promise<{ items: BenefitRow[]; total: number }> {
  const params: unknown[] = [];
  const w = where(f, params);
  const pageSize = f.pageSize ?? 20;
  params.push(pageSize, ((f.page ?? 1) - 1) * pageSize);
  const order = f.sort === "new" ? "benefits.registered_at DESC NULLS LAST, views DESC" : "views DESC, benefits.registered_at DESC NULLS LAST";
  const rows = await query<BenefitRow & { total: number }>(
    `SELECT ${COLS}, count(*) OVER ()::int AS total FROM benefits WHERE ${w}
      ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: rows, total: rows[0]?.total ?? 0 };
}

export async function benefitById(id: string): Promise<BenefitDetail | null> {
  const [r] = await query<BenefitDetail>(
    `SELECT ${COLS}, dept, target, criteria, content, apply_method, deadline, receiver, contact, url,
            to_char(modified_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS modified_at
       FROM benefits WHERE id = $1`,
    [id],
  );
  return r ?? null;
}

export async function benefitFields(): Promise<{ field: string; n: number }[]> {
  return query(
    `SELECT field, count(*)::int AS n FROM benefits
      WHERE ended_at IS NULL AND field IS NOT NULL AND (apply_end IS NULL OR apply_end >= ${TODAY})
      GROUP BY field ORDER BY n DESC`,
  );
}

export async function benefitCounts(
  f: BenefitFilter,
): Promise<{ total: number; local: number; recent: number; ended: number }> {
  const p1: unknown[] = [];
  const all = where({ ...f, localOnly: false }, p1);
  const p2: unknown[] = [];
  const local = where({ ...f, localOnly: true }, p2);
  const p3: unknown[] = [];
  const recent = where({ ...f, newDays: 60 }, p3);
  const p4: unknown[] = [];
  const ended = where({ ...f, localOnly: false, ended: "only" }, p4);
  const [[a], [b], [c], [d]] = await Promise.all([
    query<{ n: number }>(`SELECT count(*)::int AS n FROM benefits WHERE ${all}`, p1),
    query<{ n: number }>(`SELECT count(*)::int AS n FROM benefits WHERE ${local}`, p2),
    query<{ n: number }>(`SELECT count(*)::int AS n FROM benefits WHERE ${recent}`, p3),
    query<{ n: number }>(`SELECT count(*)::int AS n FROM benefits WHERE ${ended}`, p4),
  ]);
  return { total: a?.n ?? 0, local: b?.n ?? 0, recent: c?.n ?? 0, ended: d?.n ?? 0 };
}

export async function benefitRegions(): Promise<{ sido: string; sigungu: string | null; n: number }[]> {
  return query(
    `SELECT sido, sigungu, count(*)::int AS n FROM benefits WHERE sido IS NOT NULL AND ended_at IS NULL
      GROUP BY sido, sigungu ORDER BY sido, sigungu NULLS FIRST`,
  );
}
