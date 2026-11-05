// 생필품(참가격) 조회
import { query } from "./db.js";

export type GoodsRow = {
  id: string;
  name: string;
  top_name: string | null;
  mid_name: string | null;
  small_name: string | null;
  n: number;
  avg_price: number;
  min_price: number;
  max_price: number;
  lm_avg: number | null;
  sm_avg: number | null;
  dp_avg: number | null;
  cs_avg: number | null;
  discounts: number;
  plusones: number;
  prev_avg: number | null;
};

export async function goodsDays(): Promise<{ latest: string | null; prev: string | null }> {
  const rows = await query<{ d: string }>(
    `SELECT DISTINCT survey_day AS d FROM goods_stats WHERE region = '0000' ORDER BY d DESC LIMIT 2`,
  );
  return { latest: rows[0]?.d ?? null, prev: rows[1]?.d ?? null };
}

export async function goodsList(day: string, prev: string | null, region = "0000"): Promise<GoodsRow[]> {
  return query<GoodsRow>(
    `SELECT g.id, g.name, g.top_name, g.mid_name, g.small_name, s.n, s.avg_price, s.min_price, s.max_price,
            s.lm_avg, s.sm_avg, s.dp_avg, s.cs_avg, s.discounts, s.plusones, p.avg_price AS prev_avg
       FROM goods_stats s JOIN goods g ON g.id = s.good_id
       LEFT JOIN goods_stats p ON p.good_id = s.good_id AND p.region = s.region AND p.survey_day = $3
      WHERE s.survey_day = $1 AND s.region = $2
      ORDER BY g.top_name, g.mid_name, g.name`,
    [day, region, prev],
  );
}

export async function goodsRegions(day: string): Promise<{ region: string; n: number }[]> {
  return query(
    `SELECT region, count(*)::int AS n FROM goods_stats WHERE survey_day = $1 AND region <> '0000'
      GROUP BY region ORDER BY region`,
    [day],
  );
}

export type GoodsStore = { store: string; type_name: string | null; sido: string | null; sigungu: string | null; price: number; discount: boolean; plusone: boolean };

export async function goodsDetail(id: string, day: string, prev: string | null, region = "0000") {
  const [row] = await query<GoodsRow & { total_cnt: string | null; total_unit: string | null; detail: string | null }>(
    `SELECT g.id, g.name, g.top_name, g.mid_name, g.small_name, g.total_cnt, g.total_unit, g.detail,
            s.n, s.avg_price, s.min_price, s.max_price, s.lm_avg, s.sm_avg, s.dp_avg, s.cs_avg, s.discounts, s.plusones,
            p.avg_price AS prev_avg
       FROM goods g JOIN goods_stats s ON s.good_id = g.id AND s.survey_day = $2 AND s.region = $4
       LEFT JOIN goods_stats p ON p.good_id = g.id AND p.region = s.region AND p.survey_day = $3
      WHERE g.id = $1`,
    [id, day, prev, region],
  );
  if (!row) return null;
  const regionFilter = region === "0000" ? "" : "AND st.sido = $3";
  const params: unknown[] = [id, day];
  if (region !== "0000") params.push(region);
  const cheapest = await query<GoodsStore>(
    `SELECT st.name AS store, st.type_name, st.sido, st.sigungu, p.price, p.discount, p.plusone
       FROM goods_prices p JOIN goods_stores st ON st.id = p.store_id
      WHERE p.good_id = $1 AND p.survey_day = $2 ${regionFilter}
      ORDER BY p.price, st.name LIMIT 10`,
    params,
  );
  const byRegion = await query<{ region: string; avg_price: number; n: number }>(
    `SELECT region, avg_price, n FROM goods_stats WHERE good_id = $1 AND survey_day = $2 AND region <> '0000'
      ORDER BY avg_price`,
    [id, day],
  );
  return { row, cheapest, byRegion };
}
