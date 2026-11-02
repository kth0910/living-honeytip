import type { HistoryPoint, PriceRow } from "../data.js";
import { weeklyChange } from "../data.js";
import { SearchIcon, Empty } from "./layout.js";
import { itemLabel, rankLabel, josa, koDate, pct, trendOf, won, dotDate, type Trend } from "./format.js";

const CAT_ORDER = ["200", "400", "500", "600", "100", "300"];
const CAT_SHORT: Record<string, string> = {
  "100": "곡물",
  "200": "채소",
  "300": "양념·특작",
  "400": "과일",
  "500": "고기·달걀",
  "600": "수산물",
};
export const catShort = (code: string, name: string) => CAT_SHORT[code] ?? name;

export function TrendText(props: { r: number | null; label?: string; strong?: boolean }) {
  const t = trendOf(props.r);
  if (t === "none") return <span class="faint">{props.label ? `${props.label} 비교 없음` : "-"}</span>;
  const arrow = t === "up" ? "▲" : t === "down" ? "▼" : "";
  const word = t === "up" ? "올랐어요" : t === "down" ? "내렸어요" : "비슷해요";
  return (
    <span class={t} aria-label={`${props.label ?? ""} ${t === "flat" ? "비슷" : `${pct(props.r)} ${word}`}`}>
      {props.label && <span class="faint" style="font-weight:500">{props.label} </span>}
      {t === "flat" ? "비슷" : `${arrow}${pct(props.r)}`}
    </span>
  );
}

function pillClass(t: Trend) {
  return t === "up" ? "pill-up" : t === "down" ? "pill-down" : "pill-flat";
}

/** 평년(없으면 1년 전) 대비 지금 가격 수준 */
export function levelOf(r: PriceRow): { text: string; cls: string; basis: string } | null {
  const ref = r.normal ?? r.p1y;
  if (!ref) return null;
  const ratio = r.price / ref;
  const basis = r.normal ? "평년" : "작년";
  if (ratio <= 0.92) return { text: `${basis}보다 싸요`, cls: "pill-ok", basis };
  if (ratio >= 1.08) return { text: `${basis}보다 비싸요`, cls: "pill-up", basis };
  return { text: `${basis}과 비슷`, cls: "pill-flat", basis };
}

function itemHref(r: PriceRow, region: string) {
  const u = new URLSearchParams({ k: r.key });
  if (region !== "0000") u.set("r", region);
  return `/prices/item?${u}`;
}

function PickCard(props: { r: PriceRow; region: string }) {
  const { r } = props;
  const ch = weeklyChange(r);
  const t = trendOf(ch);
  return (
    <a class="card pick" href={itemHref(r, props.region)}>
      <span class="nm">{itemLabel(r)}</span>
      <span class="u">{r.unit}</span>
      <span class="pr num">{won(r.price)}</span>
      <span>
        <span class={`badge ${pillClass(t)} num`}>
          {t === "up" ? "▲" : t === "down" ? "▼" : ""}
          {pct(ch)} {t === "up" ? "올랐어요" : t === "down" ? "내렸어요" : ""}
        </span>
      </span>
    </a>
  );
}

export function PricesPage(props: {
  rows: PriceRow[];
  date: string | null;
  region: string;
  regionName: string;
  regions: { region_code: string; region_name: string; n: number }[];
  init: { c: string; q: string; s: string };
}) {
  const { rows, date } = props;
  if (!date || rows.length === 0) {
    return (
      <>
        <h1>이번 주 장보기 시세</h1>
        <p class="lead">채소·과일·고기·생선의 소매가격을 지난주와 비교해 알려드려요.</p>
        <Empty icon="⏳" title="아직 가격 정보를 불러오는 중이에요">
          가격 조사 자료는 평일 오후에 올라와요. 잠시 후 다시 확인해 주세요.
        </Empty>
      </>
    );
  }
  const withCh = rows.map((r) => ({ r, ch: weeklyChange(r) }));
  const drops = withCh.filter((x) => x.ch !== null && x.ch <= -0.05).sort((a, b) => a.ch! - b.ch!);
  const rises = withCh.filter((x) => x.ch !== null && x.ch >= 0.05).sort((a, b) => b.ch! - a.ch!);
  const compared = withCh.filter((x) => x.ch !== null).length;
  const cats = CAT_ORDER.filter((c) => rows.some((r) => r.category_code === c)).concat(
    [...new Set(rows.map((r) => r.category_code))].filter((c) => !CAT_ORDER.includes(c)),
  );
  const ordered = [...rows].sort(
    (a, b) =>
      cats.indexOf(a.category_code) - cats.indexOf(b.category_code) || itemLabel(a).localeCompare(itemLabel(b), "ko"),
  );

  const topDrops = drops.slice(0, 3).map((x) => itemLabel(x.r));
  const headline =
    compared === 0
      ? "지난주 가격과 비교할 자료를 모으는 중이에요."
      : topDrops.length
        ? `이번 주는 ${drops.length > 3 ? `${topDrops.join(", ")} 등이` : josa(topDrops.join(", "), "이", "가")} 지난주보다 싸졌어요.`
        : "이번 주는 크게 내린 품목이 없어요.";

  return (
    <>
      <h1>이번 주 장보기 시세</h1>
      <p class="lead">
        <b>{koDate(date)}</b> 조사 · {props.regionName} 평균 소매가 · 지난주와 비교
      </p>

      {props.regions.length > 1 && (
        <form action="/prices" method="get" style="margin-bottom:14px">
          <label for="pr-region" class="sr-only">
            지역
          </label>
          <select id="pr-region" name="r" data-autosubmit="">
            {props.regions.map((g) => (
              <option value={g.region_code === "0000" ? "" : g.region_code} selected={g.region_code === props.region}>
                {g.region_code === "0000" ? "전국 평균" : g.region_name}
              </option>
            ))}
          </select>
          <noscript>
            <button class="btn ghost" type="submit" style="margin-top:8px">
              지역 바꾸기
            </button>
          </noscript>
        </form>
      )}

      <div class="callout">
        <b>{headline}</b>
        {compared > 0 && (
          <div class="small" style="margin-top:4px">
            지난주보다 <span class="down">싸진 품목 {drops.length}개</span> · <span class="up">비싸진 품목 {rises.length}개</span>{" "}
            <span class="faint">(5% 이상 변동 기준)</span>
          </div>
        )}
      </div>

      {drops.length > 0 && (
        <section aria-labelledby="drop-h">
          <h2 id="drop-h">👍 지금 사면 좋아요</h2>
          <div class="picks">
            {drops.slice(0, 8).map((x) => (
              <PickCard r={x.r} region={props.region} />
            ))}
          </div>
        </section>
      )}
      {rises.length > 0 && (
        <section aria-labelledby="rise-h">
          <h2 id="rise-h">✋ 조금 기다려 봐요</h2>
          <div class="picks">
            {rises.slice(0, 8).map((x) => (
              <PickCard r={x.r} region={props.region} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="all-h">
        <h2 id="all-h" class="row">
          <span>전체 품목</span>
          <span id="pcount" class="faint small num" style="font-weight:600">
            {rows.length}개 품목
          </span>
        </h2>
        <div class="toolbar">
          <div class="chips" role="group" aria-label="부류">
            <a class="chip" href="?" data-cat-chip="" aria-pressed={props.init.c === "" ? "true" : "false"}>
              전체
            </a>
            {cats.map((c) => (
              <a
                class="chip"
                href={`?c=${c}`}
                data-cat-chip={c}
                aria-pressed={props.init.c === c ? "true" : "false"}
              >
                {catShort(c, rows.find((r) => r.category_code === c)!.category_name)}
              </a>
            ))}
          </div>
          <div class="two">
            <div class="field">
              <label for="pq" class="sr-only">
                품목 찾기
              </label>
              <SearchIcon />
              <input id="pq" type="search" placeholder="품목 찾기 (예: 배추)" value={props.init.q} autocomplete="off" />
            </div>
            <label class="sr-only" for="psort">
              정렬
            </label>
            <select id="psort" aria-label="정렬">
              <option value="cat" selected={props.init.s === "cat"}>
                종류별
              </option>
              <option value="drop" selected={props.init.s === "drop"}>
                많이 내린 순
              </option>
              <option value="rise" selected={props.init.s === "rise"}>
                많이 오른 순
              </option>
              <option value="name" selected={props.init.s === "name"}>
                이름순
              </option>
            </select>
          </div>
        </div>
        <div class="card">
          <ul class="plist" id="plist" data-cat={props.init.c}>
            {ordered.map((r, i) => {
              const ch = weeklyChange(r);
              const lvl = levelOf(r);
              const showHead = i === 0 || ordered[i - 1].category_code !== r.category_code;
              return (
                <>
                  {showHead && (
                    <li class="cat-head" data-head={r.category_code}>
                      {catShort(r.category_code, r.category_name)}
                    </li>
                  )}
                  <li data-cat={r.category_code} data-name={`${itemLabel(r)} ${r.item_name} ${r.kind_name}`} data-ch={ch ?? ""}>
                    <a class="prow" href={itemHref(r, props.region)}>
                      <span>
                        <span class="nm">{itemLabel(r)}</span>{" "}
                        <span class="u">
                          {r.unit}
                          {rankLabel(r) ? ` · ${rankLabel(r)}` : ""}
                        </span>
                      </span>
                      <span class="pr num">{won(r.price)}</span>
                      <span class="sub">{lvl ? <span class={`badge ${lvl.cls}`}>{lvl.text}</span> : null}</span>
                      <span class="ch num">
                        <TrendText r={ch} label="지난주" />
                      </span>
                    </a>
                  </li>
                </>
              );
            })}
          </ul>
          <div id="pempty" class="empty hidden">
            <p class="muted">찾는 품목이 없어요. 다른 이름으로 검색해 보세요.</p>
          </div>
        </div>
        <details class="help" style="margin-top:14px">
          <summary>가격은 어떻게 조사되나요?</summary>
          <p class="muted">
            한국농수산식품유통공사(aT)가 전국 주요 시장·마트에서 조사한 소매가격의 평균이에요. 등급은 ‘상품’ 기준으로
            보여주고, 실제 동네 가게 가격과는 차이가 있을 수 있어요. ‘지난주’는 약 7일 전 조사일과 비교한 값이에요.
          </p>
        </details>
      </section>
    </>
  );
}

/* ----------------------------- 품목 상세 ----------------------------- */

function Chart(props: { points: HistoryPoint[] }) {
  // 주 단위로 줄여서 그린다(같은 주에 여러 날이면 마지막 값)
  const byWeek = new Map<string, HistoryPoint>();
  for (const p of props.points) {
    const d = new Date(p.d + "T00:00:00Z");
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    byWeek.set(monday.toISOString().slice(0, 10), p);
  }
  const all = [...byWeek.values()];
  // 1년 전 비교용 점은 비교 칸에서 보여주고, 그래프는 최근 12주만
  const cutoff = all.length ? Date.parse(all[all.length - 1].d) - 7 * 13 * 86400_000 : 0;
  const pts = all.filter((p) => Date.parse(p.d) >= cutoff);
  if (pts.length < 2) return <p class="muted small">그래프를 그리기에는 아직 자료가 부족해요. 매주 쌓이면 보여드릴게요.</p>;
  const W = 360, H = 170, padL = 6, padR = 6, padT = 22, padB = 24;
  const t0 = Date.parse(pts[0].d), t1 = Date.parse(pts[pts.length - 1].d);
  const vals = pts.map((p) => p.price);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || max * 0.1 || 1;
  const x = (d: string) => padL + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - (min - span * 0.1)) / (span * 1.2)) * (H - padT - padB);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  const minP = pts.find((p) => p.price === min)!;
  const maxP = pts.find((p) => p.price === max)!;
  const anchor = (px: number) => (px < 60 ? "start" : px > W - 60 ? "end" : "middle");
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`최근 가격 추이: 최저 ${won(min)}, 최고 ${won(max)}, 현재 ${won(last.price)}`}>
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--line)" />
      <path d={path} fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      {pts.map((p) => (
        <circle cx={x(p.d)} cy={y(p.price)} r={p === last ? 5 : 2.5} fill={p === last ? "var(--brand)" : "var(--surface)"} stroke="var(--brand)" stroke-width="2" />
      ))}
      {maxP !== last && (
        <text x={x(maxP.d)} y={y(max) - 9} text-anchor={anchor(x(maxP.d))}>
          최고 {won(max)}
        </text>
      )}
      {minP !== last && min !== max && (
        <text x={x(minP.d)} y={y(min) + 18} text-anchor={anchor(x(minP.d))}>
          최저 {won(min)}
        </text>
      )}
      <text x={padL} y={H - 6} text-anchor="start">
        {dotDate(pts[0].d).slice(2)}
      </text>
      <text x={W - padR} y={H - 6} text-anchor="end">
        {dotDate(last.d).slice(2)}
      </text>
    </svg>
  );
}

export function PriceItemPage(props: {
  r: PriceRow;
  history: HistoryPoint[];
  regionName: string;
  regionCode: string;
  byRegion: { region_code: string; region_name: string; price: number }[];
}) {
  const { r } = props;
  const ch = weeklyChange(r);
  const t = trendOf(ch);
  const lvl = levelOf(r);
  const boxes: { k: string; v: number | null }[] = [
    { k: "지난주", v: r.p1w },
    { k: "한 달 전", v: r.p1m },
    { k: "1년 전", v: r.p1y },
    { k: "평년", v: r.normal },
  ].filter((b) => b.k !== "평년" || b.v !== null);
  const verdict =
    t === "down"
      ? "지난주보다 싸졌어요. 장바구니에 담기 좋은 때예요."
      : t === "up"
        ? "지난주보다 올랐어요. 꼭 필요하지 않다면 다음 주를 기다려 보세요."
        : t === "flat"
          ? "지난주와 비슷한 가격이에요."
          : "지난주 가격 자료가 아직 없어요.";
  const back = props.regionCode !== "0000" ? `/prices?r=${props.regionCode}` : "/prices";
  return (
    <>
      <p class="small">
        <a href={back} class="muted">
          ← 장보기 시세
        </a>
      </p>
      <h1>{itemLabel(r)}</h1>
      <p class="muted">
        {r.unit}
        {rankLabel(r) ? ` · ${rankLabel(r)}` : ""} · {catShort(r.category_code, r.category_name)} · {koDate(r.survey_date)} 조사 ·{" "}
        {props.regionName} 평균
      </p>
      <div class="card pad stack" style="margin-top:12px">
        <div class="row">
          <span class="bigprice num">{won(r.price)}</span>
          {t !== "none" && (
            <span class={`badge ${pillClass(t)} num`}>
              지난주 대비 {t === "up" ? "▲" : t === "down" ? "▼" : ""}
              {t === "flat" ? "비슷" : pct(ch, 1)}
            </span>
          )}
          {lvl && <span class={`badge ${lvl.cls}`}>{lvl.text}</span>}
        </div>
        <p>{verdict}</p>
        <div class="cmp">
          {boxes.map((b) => {
            const d = b.v ? (r.price - b.v) / b.v : null;
            return (
              <div class="box">
                <div class="k">{b.k}</div>
                <div class="v num">{won(b.v)}</div>
                <div class="d num">
                  {b.v ? <TrendText r={d} /> : <span class="faint">자료 없음</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <h2>최근 가격 흐름</h2>
      <div class="card pad">
        <Chart points={props.history} />
      </div>

      {props.byRegion.length > 1 && (
        <>
          <h2>지역별 가격</h2>
          <div class="card pad">
            <p class="small muted">같은 날 조사한 지역별 평균이에요. 싼 곳부터 보여드려요.</p>
            <table class="table num">
              <thead>
                <tr>
                  <th>지역</th>
                  <th class="r">가격</th>
                  <th class="r">전국 평균 대비</th>
                </tr>
              </thead>
              <tbody>
                {props.byRegion.map((g) => {
                  const d = (g.price - r.price) / r.price;
                  return (
                    <tr>
                      <td>
                        <a href={`/prices/item?k=${encodeURIComponent(r.key)}&r=${g.region_code}`}>{g.region_name}</a>
                      </td>
                      <td class="r">{won(g.price)}</td>
                      <td class="r">
                        <TrendText r={props.regionCode === "0000" ? d : null} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
