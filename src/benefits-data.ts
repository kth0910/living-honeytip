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
  sort?: "views" | "new";
  page?: number;
  pageSize?: number;
};

const COLS = `id, name, summary, field, user_type, support_type, agency, agency_type, views,
  to_char(registered_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS registered_at, sido, sigungu, age_min, age_max`;

function where(f: BenefitFilter, params: unknown[]): string {
  const w: string[] = ["ended_at IS NULL"];
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
    params.push(f.age);
    w.push(`(age_min IS NULL OR age_min <= $${params.length}) AND (age_max IS NULL OR age_max >= $${params.length})`);
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
    `SELECT field, count(*)::int AS n FROM benefits WHERE ended_at IS NULL AND field IS NOT NULL
      GROUP BY field ORDER BY n DESC`,
  );
}

export async function benefitCounts(f: BenefitFilter): Promise<{ total: number; local: number; recent: number }> {
  const p1: unknown[] = [];
  const all = where({ ...f, localOnly: false }, p1);
  const p2: unknown[] = [];
  const local = where({ ...f, localOnly: true }, p2);
  const p3: unknown[] = [];
  const recent = where({ ...f, newDays: 60 }, p3);
  const [[a], [b], [c]] = await Promise.all([
    query<{ n: number }>(`SELECT count(*)::int AS n FROM benefits WHERE ${all}`, p1),
    query<{ n: number }>(`SELECT count(*)::int AS n FROM benefits WHERE ${local}`, p2),
    query<{ n: number }>(`SELECT count(*)::int AS n FROM benefits WHERE ${recent}`, p3),
  ]);
  return { total: a?.n ?? 0, local: b?.n ?? 0, recent: c?.n ?? 0 };
}

export async function benefitRegions(): Promise<{ sido: string; sigungu: string | null; n: number }[]> {
  return query(
    `SELECT sido, sigungu, count(*)::int AS n FROM benefits WHERE sido IS NOT NULL AND ended_at IS NULL
      GROUP BY sido, sigungu ORDER BY sido, sigungu NULLS FIRST`,
  );
}
