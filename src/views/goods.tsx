import type { GoodsRow, GoodsStore } from "../goods-data.js";
import { PRICE_PAGE_SIZE } from "./client.js";
import { koDate, pct, tidy, won } from "./format.js";
import { Move } from "./prices.js";
import { Empty, Icon, SectionHead, Select } from "./ui.js";

/** 장보기 메뉴 안의 보기 전환 */
export function PriceTabs(props: { active: "farm" | "goods" }) {
  return (
    <nav class="seg" aria-label="장보기 보기" style="margin-bottom:4px">
      <a href="/prices" aria-current={props.active === "farm" ? "page" : undefined}>
        채소, 과일, 고기
      </a>
      <a href="/prices/goods" aria-current={props.active === "goods" ? "page" : undefined}>
        생필품
      </a>
    </nav>
  );
}

const change = (r: GoodsRow) => (r.prev_avg ? (r.avg_price - r.prev_avg) / r.prev_avg : null);
const spread = (r: GoodsRow) => (r.min_price > 0 ? r.max_price / r.min_price - 1 : 0);

/** 판매점 종류별 평균 중 가장 싼 곳 */
function cheapestType(r: GoodsRow): { name: string; price: number } | null {
  const c = [
    ["대형마트", r.lm_avg],
    ["슈퍼마켓", r.sm_avg],
    ["백화점", r.dp_avg],
    ["편의점", r.cs_avg],
  ].filter((x): x is [string, number] => typeof x[1] === "number" && x[1] > 0);
  if (c.length < 2) return null;
  c.sort((a, b) => a[1] - b[1]);
  return { name: c[0][0], price: c[0][1] };
}

function goodsHref(id: string, region: string) {
  return `/prices/goods/${encodeURIComponent(id)}${region !== "0000" ? `?r=${encodeURIComponent(region)}` : ""}`;
}

export function GoodsPage(props: {
  rows: GoodsRow[];
  day: string | null;
  prev: string | null;
  region: string;
  regions: { region: string; n: number }[];
  init: { c: string; q: string; s: string; page: number };
}) {
  const { rows, day } = props;
  const head = (
    <>
      <h1 class="page-title">생필품 가격</h1>
      <p class="page-sub">라면, 우유, 세제처럼 자주 사는 상품이 가게마다 얼마인지 알려드려요.</p>
      <PriceTabs active="goods" />
    </>
  );
  if (!day || rows.length === 0) {
    return (
      <>
        {head}
        <div class="card">
          <Empty icon="clock" title="아직 생필품 가격을 불러오는 중이에요">
            <p>한국소비자원이 2주마다 조사한 가격을 받아 오고 있어요. 잠시 후 다시 확인해 주세요.</p>
          </Empty>
        </div>
      </>
    );
  }
  const cats = [...new Set(rows.map((r) => r.mid_name ?? "기타"))];
  const bigGap = [...rows].filter((r) => r.n >= 20).sort((a, b) => spread(b) - spread(a)).slice(0, 8);
  const onSale = [...rows].filter((r) => r.discounts + r.plusones > 0).sort((a, b) => b.discounts + b.plusones - (a.discounts + a.plusones)).slice(0, 8);
  const avgGap = rows.length ? rows.reduce((s, r) => s + spread(r), 0) / rows.length : 0;
  const regionName = props.region === "0000" ? "전국" : props.region;
  const plain = props.init.s === "cat" && !props.init.c && !props.init.q && props.init.page <= 1;
  return (
    <>
      {head}
      <section class="card">
        <p class="strong" style="font-size:19px;line-height:1.45">
          같은 상품도 가게에 따라 평균 {pct(avgGap)} 차이가 나요.
        </p>
        <p class="t2 small" style="margin-top:6px">
          {koDate(day)} 조사, {regionName} {rows.length}개 상품
          {props.prev ? `, ${koDate(props.prev, { weekday: false })} 조사와 비교` : ""}
        </p>
        {props.regions.length > 1 && (
          <form action="/prices/goods" method="get" style="margin-top:16px">
            <Select name="r" label="지역" autosubmit>
              <option value="">전국</option>
              {props.regions.map((g) => (
                <option value={g.region} selected={g.region === props.region}>
                  {g.region}
                </option>
              ))}
            </Select>
          </form>
        )}
      </section>

      {bigGap.length > 0 && (
        <section class="card" aria-labelledby="gap-h">
          <SectionHead id="gap-h" title="가게마다 값이 크게 다른 상품" />
          <div class="hscroll">
            {bigGap.map((r) => (
              <a class="mini" href={goodsHref(r.id, props.region)}>
                <span class="name clamp2">{tidy(r.name)}</span>
                <span class="unit">
                  {won(r.min_price)}부터 {won(r.max_price)}까지
                </span>
                <span class="price num" style="color:var(--up)">
                  {pct(spread(r))} 차이
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
      {onSale.length > 0 && (
        <section class="card" aria-labelledby="sale-h">
          <SectionHead id="sale-h" title="할인이나 1+1을 많이 하는 상품" />
          <div class="hscroll">
            {onSale.map((r) => (
              <a class="mini" href={goodsHref(r.id, props.region)}>
                <span class="name clamp2">{tidy(r.name)}</span>
                <span class="unit">평균 {won(r.avg_price)}</span>
                <span class="price num" style="color:var(--good)">
                  {r.discounts + r.plusones}곳에서 할인
                </span>
              </a>
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
                전체 상품{" "}
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
              <a class="chip" href={`?c=${encodeURIComponent(c)}`} data-cat-chip={c} aria-pressed={props.init.c === c ? "true" : "false"}>
                {tidy(c)}
              </a>
            ))}
          </div>
          <div class="two">
            <label class="search" for="pq">
              <Icon name="search" />
              <span class="sr-only">상품 찾기</span>
              <input id="pq" type="search" placeholder="상품 찾기" value={props.init.q} autocomplete="off" />
            </label>
            <Select id="psort" label="정렬">
              <option value="cat" selected={props.init.s === "cat"}>종류별</option>
              <option value="drop" selected={props.init.s === "drop"}>많이 내린 순</option>
              <option value="rise" selected={props.init.s === "rise"}>많이 오른 순</option>
              <option value="cheap" selected={props.init.s === "cheap"}>가격 낮은 순</option>
              <option value="pricey" selected={props.init.s === "pricey"}>가격 높은 순</option>
              <option value="name" selected={props.init.s === "name"}>이름순</option>
            </Select>
          </div>
        </div>
        <ul class="rows" id="plist" data-cat={props.init.c} data-page={String(props.init.page)}>
          {rows.map((r, i) => {
            const cat = r.mid_name ?? "기타";
            const showHead = i === 0 || (rows[i - 1].mid_name ?? "기타") !== cat;
            const hide = plain && i >= PRICE_PAGE_SIZE;
            const ch = change(r);
            const ct = cheapestType(r);
            return (
              <>
                {showHead && (
                  <li class={`row-head${hide ? " hidden" : ""}`} data-head={cat}>
                    {tidy(cat)}
                  </li>
                )}
                <li class={hide ? "hidden" : undefined} data-cat={cat} data-name={`${tidy(r.name)} ${tidy(r.small_name)}`} data-ch={ch ?? ""} data-price={String(r.avg_price)}>
                  <a class="row" href={goodsHref(r.id, props.region)}>
                    <div class="main">
                      <div class="title">{tidy(r.name)}</div>
                      <div class="sub">
                        {won(r.min_price)}부터 {won(r.max_price)}까지
                        {ct ? <>, <span class="tone-good">{ct.name}가 가장 싸요</span></> : null}
                      </div>
                    </div>
                    <div class="end">
                      <div class="value num">{won(r.avg_price)}</div>
                      <Move r={ch} basis="지난 조사" />
                    </div>
                  </a>
                </li>
              </>
            );
          })}
        </ul>
        <div id="pempty" class="empty hidden">
          <p>찾는 상품이 없어요. 다른 이름으로 찾아보세요.</p>
        </div>
        <nav id="ppager" class={`pager${rows.length > PRICE_PAGE_SIZE ? "" : " hidden"}`} aria-label="상품 페이지">
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
      <p class="small t3" style="margin:12px 4px 0">
        한국소비자원 참가격이 전국 대형마트, 슈퍼마켓, 백화점, 편의점에서 2주마다 조사한 판매 가격이에요. 가격은 원 단위 평균이에요.
      </p>
    </>
  );
}

export function GoodsItemPage(props: {
  row: GoodsRow & { detail: string | null };
  cheapest: GoodsStore[];
  byRegion: { region: string; avg_price: number; n: number }[];
  day: string;
  region: string;
}) {
  const r = props.row;
  const ch = change(r);
  const types = [
    ["대형마트", r.lm_avg],
    ["슈퍼마켓", r.sm_avg],
    ["백화점", r.dp_avg],
    ["편의점", r.cs_avg],
  ].filter((x): x is [string, number] => typeof x[1] === "number" && x[1] > 0);
  const minType = types.length ? Math.min(...types.map((t) => t[1])) : null;
  const back = props.region !== "0000" ? `/prices/goods?r=${encodeURIComponent(props.region)}` : "/prices/goods";
  return (
    <>
      <a class="small t3" href={back} style="display:inline-flex;align-items:center;gap:2px;margin-top:8px">
        <Icon name="chevron-left" />
        생필품 가격
      </a>
      <section class="card">
        <div class="t3 small">{[tidy(r.top_name), tidy(r.mid_name)].filter(Boolean).join(", ")}</div>
        <h1 class="page-title" style="margin:2px 0 4px">
          {tidy(r.name)}
        </h1>
        {r.detail && <p class="t2">{tidy(r.detail)}</p>}
        <div class="big num" style="margin-top:16px">
          {won(r.avg_price)}
        </div>
        <p class="t3 small">
          {props.region === "0000" ? "전국" : props.region} {r.n}곳 평균, {koDate(props.day)} 조사
        </p>
        <div class="labels">
          {ch !== null && (
            <span class="label plain">
              지난 조사보다 <Move r={ch} />
            </span>
          )}
          {r.discounts > 0 && <span class="label good">할인 {r.discounts}곳</span>}
          {r.plusones > 0 && <span class="label good">1+1 {r.plusones}곳</span>}
        </div>
      </section>

      <section class="card">
        <SectionHead title="어디서 사면 싼가요" />
        <ul class="kv">
          <li>
            <span class="k">가장 싼 곳</span>
            <span class="v num tone-good">{won(r.min_price)}</span>
          </li>
          <li>
            <span class="k">가장 비싼 곳</span>
            <span class="v num">{won(r.max_price)}</span>
          </li>
          {types.map(([name, price]) => (
            <li>
              <span class="k">{name} 평균</span>
              <span class={`v num${price === minType ? " tone-good" : ""}`}>{won(price)}</span>
            </li>
          ))}
        </ul>
      </section>

      {props.cheapest.length > 0 && (
        <section class="card flush">
          <SectionHead title="가장 싸게 판 가게" />
          <ul class="rows">
            {props.cheapest.map((s) => (
              <li class="row" style="min-height:56px">
                <div class="main">
                  <div class="title" style="font-size:16px">{tidy(s.store)}</div>
                  <div class="sub">{[s.type_name, s.sigungu ? `${s.sido} ${s.sigungu}` : s.sido].filter(Boolean).join(", ")}</div>
                </div>
                <div class="end">
                  <div class="value num" style="font-size:16px">{won(s.price)}</div>
                  {(s.discount || s.plusone) && <span class="label good">{s.plusone ? "1+1" : "할인"}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.byRegion.length > 1 && (
        <section class="card flush">
          <SectionHead title="지역별 평균" />
          <ul class="rows">
            {props.byRegion.map((g) => (
              <li>
                <a class="row" href={`/prices/goods/${encodeURIComponent(r.id)}?r=${encodeURIComponent(g.region)}`} style="min-height:56px">
                  <div class="main">
                    <div class="title" style="font-size:16px">{g.region}</div>
                    <div class="sub">{g.n}곳</div>
                  </div>
                  <div class="end">
                    <div class="value num" style="font-size:16px">{won(g.avg_price)}</div>
                  </div>
                  <Icon name="chevron-right" class="chev" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
