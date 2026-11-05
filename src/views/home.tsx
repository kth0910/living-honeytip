import type { BizSummary, GradeRow, PriceRow, RegionCount } from "../data.js";
import type { BenefitRow } from "../benefits-data.js";
import { BenefitRowItem } from "./benefits.js";
import { weeklyChange } from "../data.js";
import { BizRow, GradeRowItem, RegionOptions, SearchBox } from "./hygiene.js";
import { Move } from "./prices.js";
import { itemSub, itemTitle, koDate, won } from "./format.js";
import { Icon, SectionHead, Select, Tile } from "./ui.js";

export function HomePage(props: {
  region: string;
  regions: RegionCount[];
  recent: BizSummary[];
  graded: { items: GradeRow[]; total: number };
  benefits: { items: BenefitRow[]; total: number };
  priceDate: string | null;
  drops: PriceRow[];
  rises: PriceRow[];
}) {
  const regionLabel = props.region || "전국";
  const hygieneHref = `/hygiene${props.region ? `?r=${encodeURIComponent(props.region)}` : ""}`;
  return (
    <>
      <h1 class="page-title">
        오늘 어디서 먹고,
        <br />
        무엇을 살까요?
      </h1>
      <p class="page-sub">우리 동네 식당 위생 기록과 이번 주 장보기 물가를 공공데이터로 알려드려요.</p>

      <SearchBox id="home-q" region={props.region} placeholder="가게 이름으로 위생 기록 찾기" />

      <section class="card flush">
        <ul class="rows">
          <li>
            <a class="row" href="/hygiene">
              <Tile icon="bowl" color="red" />
              <div class="main">
                <div class="title">식당 위생 체크</div>
                <div class="sub">처분받은 식당과 위생등급을 받은 식당을 동네별로 봐요</div>
              </div>
              <Icon name="chevron-right" class="chev" />
            </a>
          </li>
          <li>
            <a class="row" href="/benefits">
              <Tile icon="gift" color="blue" />
              <div class="main">
                <div class="title">나에게 맞는 혜택</div>
                <div class="sub">사는 곳과 나이로 받을 수 있는 지원금을 찾아봐요</div>
              </div>
              <Icon name="chevron-right" class="chev" />
            </a>
          </li>
          <li>
            <a class="row" href="/prices">
              <Tile icon="basket" color="green" />
              <div class="main">
                <div class="title">이번 주 장보기 시세</div>
                <div class="sub">채소, 과일, 고기, 생선 값이 지난주보다 올랐는지 봐요</div>
              </div>
              <Icon name="chevron-right" class="chev" />
            </a>
          </li>
        </ul>
      </section>

      {props.benefits.items.length > 0 && (
        <section class="card flush" aria-labelledby="h-ben">
          <SectionHead id="h-ben" title={`${regionLabel}에서 많이 찾는 혜택`} more={{ href: "/benefits", label: "더 보기" }} />
          <p class="small t3" style="padding:0 20px 4px">
            받을 수 있는 혜택 {props.benefits.total.toLocaleString()}개 중에서
          </p>
          <ul class="rows">
            {props.benefits.items.map((b) => (
              <li>
                <BenefitRowItem b={b} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(props.drops.length > 0 || props.rises.length > 0) && (
        <section class="card flush" aria-labelledby="h-price">
          <SectionHead id="h-price" title="이번 주 장바구니" more={{ href: "/prices", label: "전체 보기" }} />
          <p class="small t3" style="padding:0 20px 4px">
            {koDate(props.priceDate)} 조사, 전국 평균
          </p>
          <ul class="rows">
            {[...props.drops.map((r) => ({ r, hint: "지금 사면 좋아요" })), ...props.rises.map((r) => ({ r, hint: "조금 기다려 봐요" }))].map(
              ({ r, hint }) => (
                <li>
                  <a class="row" href={`/prices/item?k=${encodeURIComponent(r.key)}`}>
                    <div class="main">
                      <div class="title">{itemTitle(r)}</div>
                      <div class="sub">
                        {itemSub(r)}, {hint}
                      </div>
                    </div>
                    <div class="end">
                      <div class="value num">{won(r.price)}</div>
                      <Move r={weeklyChange(r)} basis="지난주" />
                    </div>
                  </a>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      {props.graded.items.length > 0 && (
        <section class="card flush" aria-labelledby="h-grade">
          <SectionHead
            id="h-grade"
            title={`${regionLabel} 위생등급 식당`}
            more={{ href: `/hygiene?v=grade${props.region ? `&r=${encodeURIComponent(props.region)}` : ""}`, label: "더 보기" }}
          />
          <p class="small t3" style="padding:0 20px 4px">
            식약처가 위생 관리 수준을 평가해 지정한 곳 {props.graded.total.toLocaleString()}곳
          </p>
          <ul class="rows">
            {props.graded.items.map((g) => (
              <li>
                <GradeRowItem g={g} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {props.regions.length > 0 && (
        <section class="card flush" aria-labelledby="h-hyg">
          <SectionHead id="h-hyg" title={`${regionLabel} 최근 위생 처분`} more={{ href: hygieneHref, label: "더 보기" }} />
          <form action="/" method="get" style="padding:0 20px 8px">
            <Select name="r" label="동네" autosubmit>
              <RegionOptions regions={props.regions} value={props.region} allLabel="전국 (동네를 골라 보세요)" />
            </Select>
            <noscript>
              <button class="btn secondary small" type="submit" style="margin-top:8px">
                이 동네로 보기
              </button>
            </noscript>
          </form>
          {props.recent.length ? (
            <ul class="rows">
              {props.recent.map((b) => (
                <li>
                  <BizRow b={b} />
                </li>
              ))}
            </ul>
          ) : (
            <p class="t2" style="padding:12px 20px 16px">
              최근 1년 동안 이 동네에 공개된 위생 처분이 없어요.
            </p>
          )}
        </section>
      )}
    </>
  );
}

export function AboutPage(props: { runs: Record<string, { lastOk?: any; last?: any }> }) {
  const row = (job: string, label: string) => {
    const r = props.runs[job];
    const when = r?.lastOk?.finished_at
      ? new Date(r.lastOk.finished_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" })
      : "아직 없음";
    const state = !r?.last ? "대기 중" : r.last.status === "error" ? "확인 필요" : r.last.status === "running" ? "받는 중" : "정상";
    return (
      <li>
        <span class="k">{label}</span>
        <span class="v">
          {state}
          <span class="t3 small" style="display:block;font-weight:500">
            {when}
          </span>
        </span>
      </li>
    );
  };
  return (
    <>
      <h1 class="page-title">서비스 안내</h1>
      <p class="page-sub">정부가 공개한 데이터를 누구나 쉽게 읽을 수 있게 정리했어요. 광고나 회원가입 없이 쓸 수 있어요.</p>
      <section class="card">
        <SectionHead title="식당 위생 체크" />
        <p class="t2">
          식품의약품안전처 식품안전나라의 행정처분 결과를 매일 새벽에 받아와요. 일반음식점, 카페 같은 휴게음식점, 제과점,
          주점과 급식소가 들어 있어요. 처분이 공개되는 기간이 정해져 있어서 오래된 처분은 보이지 않을 수 있어요.
        </p>
      </section>
      <section class="card">
        <SectionHead title="장보기 시세" />
        <p class="t2">
          한국농수산식품유통공사(aT)의 일별 도소매 가격정보 중 소매가격을 하루 두 번 받아와요. 같은 품목의 지난주, 한 달 전,
          1년 전 가격과 비교해 보여드려요.
        </p>
      </section>
      <section class="card">
        <SectionHead title="데이터 갱신 상태" />
        <ul class="kv">
          {row("hygiene", "식당 위생")}
          {row("prices", "장보기 시세")}
        </ul>
      </section>
      <p class="small t3" style="margin:12px 4px 0">
        이 서비스의 정보는 참고용이에요. 정확한 내용은 식품안전나라와 KAMIS에서 확인해 주세요.
      </p>
    </>
  );
}
