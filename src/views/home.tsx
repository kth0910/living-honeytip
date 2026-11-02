import type { BizSummary, PriceRow, RegionCount } from "../data.js";
import { weeklyChange } from "../data.js";
import { BizItem, RegionSelect } from "./hygiene.js";
import { itemLabel, koDate, pct, won } from "./format.js";
import { SearchIcon } from "./layout.js";

export function HomePage(props: {
  region: string;
  regions: RegionCount[];
  recent: BizSummary[];
  priceDate: string | null;
  drops: PriceRow[];
  rises: PriceRow[];
}) {
  const regionLabel = props.region || "전국";
  return (
    <>
      <h1>
        오늘 어디서 먹고,
        <br />
        무엇을 살까요?
      </h1>
      <p class="lead">공공데이터로 확인하는 우리 동네 식당 위생 기록과 이번 주 장바구니 물가.</p>

      <form class="search" action="/hygiene" method="get" role="search" aria-label="식당 위생 검색">
        <div class="field">
          <label for="home-q" class="sr-only">
            가게 이름이나 동네
          </label>
          <SearchIcon />
          <input id="home-q" type="search" name="q" placeholder="가게 이름으로 위생 기록 찾기" enterkeyhint="search" autocomplete="off" />
        </div>
        {props.region && <input type="hidden" name="r" value={props.region} />}
      </form>

      <div class="hero-grid">
        <a class="card feature" href="/hygiene">
          <div class="icon" style="background:var(--sev3-soft)" aria-hidden="true">
            🍽️
          </div>
          <h2>식당 위생 체크</h2>
          <p class="muted small">
            영업정지, 과태료처럼 위생 규정을 어겨 받은 처분 기록을 가게 이름이나 동네로 찾아봐요.
          </p>
          <span class="go">위생 기록 보기 →</span>
        </a>
        <a class="card feature" href="/prices">
          <div class="icon" style="background:var(--ok-soft)" aria-hidden="true">
            🧺
          </div>
          <h2>이번 주 장보기 시세</h2>
          <p class="muted small">채소·과일·고기·생선 가격이 지난주보다 올랐는지 내렸는지 한눈에 봐요.</p>
          <span class="go">시세 보기 →</span>
        </a>
      </div>

      {(props.drops.length > 0 || props.rises.length > 0) && (
        <section aria-labelledby="h-price">
          <h2 id="h-price" class="row">
            <span>이번 주 장바구니</span>
            <span class="faint small" style="font-weight:500">
              {koDate(props.priceDate)} 조사 · 전국
            </span>
          </h2>
          <div class="card">
            <ul class="plist">
              {props.drops.map((r) => (
                <li>
                  <a class="prow" href={`/prices/item?k=${encodeURIComponent(r.key)}`}>
                    <span>
                      <span class="nm">{itemLabel(r)}</span> <span class="u">{r.unit}</span>
                    </span>
                    <span class="pr num">{won(r.price)}</span>
                    <span class="sub">지금 사면 좋아요</span>
                    <span class="ch num down">▼{pct(weeklyChange(r))}</span>
                  </a>
                </li>
              ))}
              {props.rises.map((r) => (
                <li>
                  <a class="prow" href={`/prices/item?k=${encodeURIComponent(r.key)}`}>
                    <span>
                      <span class="nm">{itemLabel(r)}</span> <span class="u">{r.unit}</span>
                    </span>
                    <span class="pr num">{won(r.price)}</span>
                    <span class="sub">조금 기다려 봐요</span>
                    <span class="ch num up">▲{pct(weeklyChange(r))}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <p class="small" style="margin-top:8px">
            <a href="/prices">전체 품목 보기 →</a>
          </p>
        </section>
      )}

      {props.regions.length > 0 && (
        <section aria-labelledby="h-hyg">
          <h2 id="h-hyg">{regionLabel} 최근 위생 처분</h2>
          <form action="/" method="get" style="margin-bottom:10px">
            <RegionSelect regions={props.regions} value={props.region} autosubmit allLabel="전국 (동네를 골라 보세요)" />
            <noscript>
              <button class="btn ghost" type="submit" style="margin-top:8px">
                동네 바꾸기
              </button>
            </noscript>
          </form>
          {props.recent.length ? (
            <div class="card">
              {props.recent.map((b) => (
                <BizItem b={b} />
              ))}
            </div>
          ) : (
            <p class="muted">최근 1년 동안 이 지역에 공개된 처분이 없어요.</p>
          )}
          <p class="small" style="margin-top:8px">
            <a href={`/hygiene${props.region ? `?r=${encodeURIComponent(props.region)}` : ""}`}>{regionLabel} 위생 기록 더 보기 →</a>
          </p>
        </section>
      )}
    </>
  );
}

export function AboutPage(props: { runs: Record<string, { lastOk?: any; last?: any }> }) {
  const row = (job: string, label: string) => {
    const r = props.runs[job];
    return (
      <tr>
        <td>{label}</td>
        <td>{r?.lastOk?.finished_at ? new Date(r.lastOk.finished_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "아직 없음"}</td>
        <td>{r?.last ? (r.last.status === "error" ? "오류" : r.last.status === "running" ? "진행 중" : "정상") : "-"}</td>
      </tr>
    );
  };
  return (
    <>
      <h1>이 서비스에 대해</h1>
      <div class="stack">
        <p>
          동네살림은 정부가 공개한 데이터를 누구나 쉽게 읽을 수 있게 정리해 보여주는 서비스예요. 광고나 회원가입 없이
          쓸 수 있어요.
        </p>
        <h2>식당 위생 체크</h2>
        <p>
          식품의약품안전처 식품안전나라의 「행정처분결과」를 매일 새벽에 받아와요. 일반음식점, 휴게음식점(카페·분식),
          제과점, 유흥·단란주점 등이 포함돼요. 처분이 공개되는 기간이 정해져 있어서, 오래된 처분은 보이지 않을 수 있어요.
        </p>
        <h2>장보기 시세</h2>
        <p>
          한국농수산식품유통공사(aT)의 「일별 도·소매 가격정보」 중 소매가격을 하루 두 번 받아와요. 같은 품목의 지난주,
          한 달 전, 1년 전 가격과 비교해 보여드려요.
        </p>
        <h2>데이터 갱신 상태</h2>
        <table class="table">
          <thead>
            <tr>
              <th>자료</th>
              <th>마지막 갱신</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {row("hygiene", "식당 위생")}
            {row("prices", "장보기 시세")}
          </tbody>
        </table>
        <p class="faint small">
          이 서비스의 정보는 참고용이에요. 정확한 내용은 식품안전나라(foodsafetykorea.go.kr)와 KAMIS(kamis.or.kr)에서
          확인하세요.
        </p>
      </div>
    </>
  );
}
