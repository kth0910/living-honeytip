import type { HistoryPoint, PriceRow } from "../data.js";
import { weeklyChange } from "../data.js";
import { itemSub, itemTitle, josa, koDate, kindName, pct, rankLabel, shortDate, tidy, trendOf, won, type Trend } from "./format.js";
import { Empty, Icon, SectionHead, Select } from "./ui.js";
import { PRICE_PAGE_SIZE } from "./client.js";
import { PriceTabs } from "./goods.js";

const CAT_ORDER = ["200", "400", "500", "600", "100", "300"];
const CAT_SHORT: Record<string, string> = {
  "100": "곡물",
  "200": "채소",
  "300": "버섯과 견과",
  "400": "과일",
  "500": "고기와 달걀",
  "600": "수산물",
};
export const catShort = (code: string, name: string) => CAT_SHORT[code] ?? name;

/** 등락을 아이콘과 숫자로. 시각 정보와 같은 내용을 화면 낭독기용 문장으로도 준다. */
export function Move(props: { r: number | null; basis?: string }) {
  const t = trendOf(props.r);
  if (t === "none") return <span class="move flat">{props.basis ? `${props.basis} 자료 없음` : "자료 없음"}</span>;
  if (t === "flat") return <span class="move flat">{props.basis ? `${props.basis}과 비슷` : "비슷"}</span>;
  const word = t === "up" ? "올랐어요" : "내렸어요";
  return (
    <span class={`move ${t}`}>
      <Icon name={t === "up" ? "caret-up" : "caret-down"} />
      {pct(props.r)}
      <span class="sr-only">
        {props.basis ? `${props.basis}보다 ` : ""}
        {word}
      </span>
    </span>
  );
}

function labelClass(t: Trend) {
  return t === "up" ? "up" : t === "down" ? "down" : "flat";
}

/** 평년(없으면 1년 전) 대비 지금 가격 수준 */
export function levelOf(r: PriceRow): { text: string; cls: string } | null {
  const ref = r.normal ?? r.p1y;
  if (!ref) return null;
  const ratio = r.price / ref;
  const basis = r.normal ? "평년" : "작년";
  if (ratio <= 0.92) return { text: `${basis}보다 싸요`, cls: "good" };
  if (ratio >= 1.08) return { text: `${basis}보다 비싸요`, cls: "up" };
  return { text: `${basis}과 비슷해요`, cls: "flat" };
}

function itemHref(r: PriceRow, region: string) {
  const u = new URLSearchParams({ k: r.key });
  if (region !== "0000") u.set("r", region);
  return `/prices/item?${u}`;
}

function MiniCard(props: { r: PriceRow; region: string }) {
  const { r } = props;
  return (
    <a class="mini" href={itemHref(r, props.region)}>
      <span class="name">{itemTitle(r)}</span>
      <span class="unit">{tidy(r.unit)}</span>
      <span class="price num">{won(r.price)}</span>
      <span style="margin-top:4px">
        <Move r={weeklyChange(r)} basis="지난주" />
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
  init: { c: string; q: string; s: string; page: number };
}) {
  const { rows, date } = props;
  if (!date || rows.length === 0) {
    return (
      <>
        <h1 class="page-title">이번 주 장보기 시세</h1>
        <p class="page-sub">채소, 과일, 고기, 생선의 소매가격을 지난주와 비교해 알려드려요.</p>
        <PriceTabs active="farm" />
        <div class="card">
          <Empty icon="clock" title="아직 가격 정보를 불러오는 중이에요">
            <p>가격 조사 자료는 평일 오후에 올라와요. 잠시 후 다시 확인해 주세요.</p>
          </Empty>
        </div>
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
      cats.indexOf(a.category_code) - cats.indexOf(b.category_code) || itemTitle(a).localeCompare(itemTitle(b), "ko"),
  );
  const topNames = [...new Set(drops.map((x) => x.r.item_name))].slice(0, 3);
  const plain = props.init.s === "cat" && !props.init.c && !props.init.q && props.init.page <= 1;
  const headline =
    compared === 0
      ? "지난주 가격과 비교할 자료를 모으고 있어요."
      : topNames.length
        ? `이번 주는 ${josa(topNames.join(", "), "이", "가")} 지난주보다 싸졌어요.`
        : "이번 주는 크게 내린 품목이 없어요.";

  return (
    <>
      <h1 class="page-title">이번 주 장보기 시세</h1>
      <p class="page-sub">
        {koDate(date)} 조사한 {props.regionName} 평균 소매가예요.
      </p>
      <PriceTabs active="farm" />

      <section class="card">
        <p class="strong" style="font-size:19px;line-height:1.45">
          {headline}
        </p>
        {compared > 0 && (
          <div class="labels" style="margin-top:12px">
            <span class="label down">싸진 품목 {drops.length}개</span>
            <span class="label up">비싸진 품목 {rises.length}개</span>
          </div>
        )}
        {props.regions.length > 1 && (
          <form action="/prices" method="get" style="margin-top:16px">
            <Select name="r" id="pr-region" label="지역" autosubmit>
              {props.regions.map((g) => (
                <option value={g.region_code === "0000" ? "" : g.region_code} selected={g.region_code === props.region}>
                  {g.region_code === "0000" ? "전국 평균" : `${g.region_name} 평균`}
                </option>
              ))}
            </Select>
            <noscript>
              <button class="btn secondary small" type="submit" style="margin-top:8px">
                이 지역으로 보기
              </button>
            </noscript>
          </form>
        )}
      </section>

      {drops.length > 0 && (
        <section class="card" aria-labelledby="drop-h">
          <SectionHead id="drop-h" title="지금 사면 좋아요" />
          <div class="hscroll">
            {drops.slice(0, 10).map((x) => (
              <MiniCard r={x.r} region={props.region} />
            ))}
          </div>
        </section>
      )}
      {rises.length > 0 && (
        <section class="card" aria-labelledby="rise-h">
          <SectionHead id="rise-h" title="조금 기다려 봐요" />
          <div class="hscroll">
            {rises.slice(0, 10).map((x) => (
              <MiniCard r={x.r} region={props.region} />
            ))}
          </div>
        </section>
      )}

      <section class="card flush" aria-labelledby="all-h" style="padding-top:0;overflow:clip">
        <div style="padding:20px 20px 4px">
          <SectionHead
            id="all-h"
            title={
              <>
                전체 품목{" "}
                <span id="pcount" class="t3 num" style="font-size:16px;font-weight:600">
                  {rows.length}개
                </span>
              </>
            }
          />
        </div>
        <div class="toolbar">
          <div class="chips scroll" role="group" aria-label="종류">
            <a class="chip" href="?" data-cat-chip="" aria-pressed={props.init.c === "" ? "true" : "false"}>
              전체
            </a>
            {cats.map((c) => (
              <a class="chip" href={`?c=${c}`} data-cat-chip={c} aria-pressed={props.init.c === c ? "true" : "false"}>
                {catShort(c, rows.find((r) => r.category_code === c)!.category_name)}
              </a>
            ))}
          </div>
          <div class="two">
            <label class="search" for="pq">
              <Icon name="search" />
              <span class="sr-only">품목 찾기</span>
              <input id="pq" type="search" placeholder="품목 찾기" value={props.init.q} autocomplete="off" />
            </label>
            <Select id="psort" label="정렬">
              <option value="cat" selected={props.init.s === "cat"}>
                종류별
              </option>
              <option value="drop" selected={props.init.s === "drop"}>
                많이 내린 순
              </option>
              <option value="rise" selected={props.init.s === "rise"}>
                많이 오른 순
              </option>
              <option value="cheap" selected={props.init.s === "cheap"}>
                가격 낮은 순
              </option>
              <option value="pricey" selected={props.init.s === "pricey"}>
                가격 높은 순
              </option>
              <option value="name" selected={props.init.s === "name"}>
                이름순
              </option>
            </Select>
          </div>
        </div>
        <ul class="rows" id="plist" data-cat={props.init.c} data-page={String(props.init.page)}>
          {ordered.map((r, i) => {
            const ch = weeklyChange(r);
            const lvl = levelOf(r);
            const showHead = i === 0 || ordered[i - 1].category_code !== r.category_code;
            // 스크립트가 돌기 전에도 첫 페이지만 보이게 (기본 상태일 때)
            const preHide = plain && i >= PRICE_PAGE_SIZE;
            const headHidden = plain && i >= PRICE_PAGE_SIZE;
            return (
              <>
                {showHead && (
                  <li class={`row-head${headHidden ? " hidden" : ""}`} data-head={r.category_code}>
                    {catShort(r.category_code, r.category_name)}
                  </li>
                )}
                <li
                  class={preHide ? "hidden" : undefined}
                  data-cat={r.category_code}
                  data-name={`${itemTitle(r)} ${tidy(r.item_name)} ${tidy(r.kind_name)}`}
                  data-ch={ch ?? ""}
                  data-price={String(r.price)}
                >
                  <a class="row" href={itemHref(r, props.region)}>
                    <div class="main">
                      <div class="title">{itemTitle(r)}</div>
                      <div class="sub">
                        {itemSub(r)}
                        {lvl && (
                          <>
                            , <span class={`tone-${lvl.cls}`}>{lvl.text}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div class="end">
                      <div class="value num">{won(r.price)}</div>
                      <Move r={ch} basis="지난주" />
                    </div>
                  </a>
                </li>
              </>
            );
          })}
        </ul>
        <div id="pempty" class="empty hidden">
          <p>찾는 품목이 없어요. 다른 이름으로 찾아보세요.</p>
        </div>
        <nav id="ppager" class={`pager${rows.length > PRICE_PAGE_SIZE ? "" : " hidden"}`} aria-label="품목 페이지">
          <button id="pprev" type="button" class="btn secondary small" aria-label="이전 페이지" disabled>
            <Icon name="chevron-left" />
            이전
          </button>
          <span id="ppos" class="t3 small num" aria-live="polite">
            1 / {Math.max(1, Math.ceil(rows.length / PRICE_PAGE_SIZE))}
          </span>
          <button id="pnext" type="button" class="btn secondary small" aria-label="다음 페이지">
            다음
            <Icon name="chevron-right" />
          </button>
        </nav>
      </section>

      <section class="card">
        <details class="more-info">
          <summary>
            <Icon name="info" />
            가격은 어떻게 조사하나요
            <Icon name="chevron-down" />
          </summary>
          <div class="body">
            <p class="t2 small">
              한국농수산식품유통공사(aT)가 전국 주요 시장과 마트에서 조사한 소매가격의 평균이에요. 등급은 상품 기준으로
              보여드리고, 실제 동네 가게 가격과는 차이가 있을 수 있어요. 지난주 가격은 약 7일 전 조사일과 비교했어요.
            </p>
          </div>
        </details>
      </section>
    </>
  );
}

/* ----------------------------- 품목 상세 ----------------------------- */

function Chart(props: { points: HistoryPoint[] }) {
  // 주 단위로 줄여서 그린다(같은 주에 여러 날이면 마지막 값). 1년 전 점은 비교 목록에서 보여준다.
  const byWeek = new Map<string, HistoryPoint>();
  for (const p of props.points) {
    const d = new Date(p.d + "T00:00:00Z");
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    byWeek.set(monday.toISOString().slice(0, 10), p);
  }
  const all = [...byWeek.values()];
  const cutoff = all.length ? Date.parse(all[all.length - 1].d) - 7 * 13 * 86400_000 : 0;
  const pts = all.filter((p) => Date.parse(p.d) >= cutoff);
  if (pts.length < 2) return <p class="t3 small">그래프를 그리기에는 아직 자료가 부족해요. 매주 쌓이면 보여드릴게요.</p>;
  const W = 360, H = 180, padL = 8, padR = 8, padT = 26, padB = 26;
  const t0 = Date.parse(pts[0].d), t1 = Date.parse(pts[pts.length - 1].d);
  const vals = pts.map((p) => p.price);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || max * 0.1 || 1;
  const x = (d: string) => padL + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - (min - span * 0.1)) / (span * 1.2)) * (H - padT - padB);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts[pts.length - 1].d).toFixed(1)},${H - padB} L${x(pts[0].d).toFixed(1)},${H - padB} Z`;
  const last = pts[pts.length - 1];
  const minP = pts.find((p) => p.price === min)!;
  const maxP = pts.find((p) => p.price === max)!;
  const anchor = (px: number) => (px < 60 ? "start" : px > W - 60 ? "end" : "middle");
  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`최근 12주 가격. 가장 낮을 때 ${won(min)}, 가장 높을 때 ${won(max)}, 지금 ${won(last.price)}`}>
      <defs>
        <linearGradient id="fillg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--brand)" stop-opacity="0.18" />
          <stop offset="1" stop-color="var(--brand)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#fillg)" />
      <path d={line} fill="none" stroke="var(--brand)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      <circle cx={x(last.d)} cy={y(last.price)} r="5" fill="var(--brand)" stroke="var(--surface)" stroke-width="2" />
      {maxP !== last && (
        <text x={x(maxP.d)} y={y(max) - 10} text-anchor={anchor(x(maxP.d))}>
          가장 높을 때 {won(max)}
        </text>
      )}
      {minP !== last && min !== max && (
        <text x={x(minP.d)} y={y(min) + 20} text-anchor={anchor(x(minP.d))}>
          가장 낮을 때 {won(min)}
        </text>
      )}
      <text x={padL} y={H - 6} text-anchor="start">
        {shortDate(pts[0].d)}
      </text>
      <text x={W - padR} y={H - 6} text-anchor="end">
        {shortDate(last.d)}
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
  const compare: { k: string; v: number | null }[] = [
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
  const facts = [kindName(r), r.unit, rankLabel(r)].map(tidy).filter(Boolean).join(", ");
  return (
    <>
      <a class="small t3" href={back} style="display:inline-flex;align-items:center;gap:2px;margin-top:8px">
        <Icon name="chevron-left" />
        장보기 시세
      </a>
      <section class="card">
        <div class="t3 small">
          {catShort(r.category_code, r.category_name)}
        </div>
        <h1 class="page-title" style="margin:2px 0 4px">
          {tidy(r.item_name)}
        </h1>
        {facts && <p class="t2">{facts}</p>}
        <div class="big num" style="margin-top:16px">
          {won(r.price)}
        </div>
        <div class="labels">
          {t !== "none" && (
            <span class={`label ${labelClass(t)}`}>
              {t === "flat" ? "지난주와 비슷" : (
                <>
                  <Icon name={t === "up" ? "caret-up" : "caret-down"} />
                  지난주보다 {pct(ch, 1)}
                </>
              )}
            </span>
          )}
          {lvl && <span class={`label ${lvl.cls}`}>{lvl.text}</span>}
        </div>
        <p class="t2" style="margin-top:12px">
          {verdict}
        </p>
        <p class="t3 small" style="margin-top:4px">
          {koDate(r.survey_date)} 조사, {props.regionName} 평균
        </p>
      </section>

      <section class="card">
        <SectionHead title="예전 가격과 비교" />
        <ul class="kv">
          {compare.map((b) => {
            const d = b.v ? (r.price - b.v) / b.v : null;
            return (
              <li>
                <span class="k">{b.k}</span>
                <span class="v">
                  <span class="num">{b.v ? won(b.v) : "자료 없음"}</span>
                  {b.v ? (
                    <span style="display:block;margin-top:2px">
                      <Move r={d} />
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section class="card">
        <SectionHead title="최근 12주 가격" />
        <Chart points={props.history} />
      </section>

      {props.byRegion.length > 1 && (
        <section class="card flush">
          <SectionHead title="지역별 가격" />
          <p class="small t3" style="padding:0 20px 8px">
            같은 날 조사한 지역별 평균이에요. 싼 곳부터 보여드려요.
          </p>
          <ul class="rows">
            {props.byRegion.map((g) => {
              const d = (g.price - r.price) / r.price;
              return (
                <li>
                  <a class="row" href={`/prices/item?k=${encodeURIComponent(r.key)}&r=${g.region_code}`} style="min-height:56px">
                    <div class="main">
                      <div class="title" style="font-size:16px">
                        {g.region_name}
                      </div>
                    </div>
                    <div class="end">
                      <div class="value num" style="font-size:16px">
                        {won(g.price)}
                      </div>
                      <Move r={d} basis="전국 평균" />
                    </div>
                    <Icon name="chevron-right" class="chev" />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
