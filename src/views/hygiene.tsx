import type { ActionRow, BizSummary, RegionCount } from "../data.js";
import { SEVERITY_HINT, SEVERITY_LABEL, violationTags } from "../lib/severity.js";
import { SIDO_ORDER } from "../lib/region.js";
import { ago, dotDate } from "./format.js";
import { Empty, SearchIcon } from "./layout.js";

export type HygieneQuery = {
  q: string;
  region: string; // "" | "서울" | "서울 강남구"
  sev: number; // 1 | 2 | 3
  period: string; // "1y" | "3y" | "all"
  page: number;
};

export function SeverityBadge(props: { sev: number; label?: string | null }) {
  const icon = props.sev >= 3 ? "⛔" : props.sev === 2 ? "⚠️" : "ℹ️";
  return (
    <span class={`badge sev${props.sev}`} title={SEVERITY_HINT[props.sev]}>
      <span aria-hidden="true">{icon}</span>
      {props.label || SEVERITY_LABEL[props.sev]}
    </span>
  );
}

export function RegionSelect(props: { regions: RegionCount[]; value: string; name?: string; id?: string; autosubmit?: boolean; allLabel?: string }) {
  const bySido = new Map<string, RegionCount[]>();
  for (const r of props.regions) {
    if (!bySido.has(r.sido)) bySido.set(r.sido, []);
    if (r.sigungu) bySido.get(r.sido)!.push(r);
  }
  const sidos = [...bySido.keys()].sort((a, b) => SIDO_ORDER.indexOf(a) - SIDO_ORDER.indexOf(b));
  return (
    <select name={props.name ?? "r"} id={props.id} aria-label="지역" data-autosubmit={props.autosubmit ? "" : undefined}>
      <option value="">{props.allLabel ?? "전국"}</option>
      {sidos.map((sido) => (
        <optgroup label={sido}>
          <option value={sido} selected={props.value === sido}>
            {sido} 전체
          </option>
          {bySido.get(sido)!.map((r) => {
            const v = `${sido} ${r.sigungu}`;
            return (
              <option value={v} selected={props.value === v}>
                {sido} {r.sigungu}
              </option>
            );
          })}
        </optgroup>
      ))}
    </select>
  );
}

export function SearchForm(props: { q: HygieneQuery; regions: RegionCount[]; compact?: boolean }) {
  const { q } = props;
  return (
    <form class="search" action="/hygiene" method="get" role="search">
      <div class="field">
        <label for="hq" class="sr-only">
          가게 이름이나 동네
        </label>
        <SearchIcon />
        <input
          id="hq"
          type="search"
          name="q"
          value={q.q}
          placeholder="가게 이름이나 동네 (예: 김밥 역삼동)"
          autocomplete="off"
          enterkeyhint="search"
        />
      </div>
      {!props.compact && (
        <div class="filters">
          <RegionSelect regions={props.regions} value={q.region} />
          <select name="sev" aria-label="처분 수준">
            <option value="1" selected={q.sev <= 1}>
              모든 처분
            </option>
            <option value="2" selected={q.sev === 2}>
              영업정지 이상
            </option>
            <option value="3" selected={q.sev >= 3}>
              영업취소·폐쇄만
            </option>
          </select>
          <select name="p" aria-label="기간">
            <option value="1y" selected={q.period === "1y"}>
              최근 1년
            </option>
            <option value="3y" selected={q.period === "3y"}>
              최근 3년
            </option>
            <option value="all" selected={q.period === "all"}>
              전체 기간
            </option>
          </select>
          <button class="btn" type="submit">
            찾기
          </button>
        </div>
      )}
    </form>
  );
}

export function BizItem(props: { b: BizSummary }) {
  const b = props.b;
  const tags = violationTags(b.last_violation);
  return (
    <a class="biz" href={`/hygiene/b/${b.biz_key}`}>
      <div class="row">
        <span class="name">{b.biz_name}</span>
        {b.biz_type && <span class="tag">{b.biz_type}</span>}
      </div>
      {b.addr && <div class="addr">{b.addr}</div>}
      <div class="row meta">
        <SeverityBadge sev={b.max_severity} />
        <span class="when num">
          처분 {b.actions}회 · 최근 {dotDate(b.last_date)} ({ago(b.last_date)})
        </span>
      </div>
      {tags.length > 0 ? (
        <div class="row" style="margin-top:6px">
          {tags.map((t) => (
            <span class="tag">{t}</span>
          ))}
        </div>
      ) : (
        b.last_violation && <div class="viol">{b.last_violation}</div>
      )}
    </a>
  );
}

export function HygienePage(props: {
  q: HygieneQuery;
  regions: RegionCount[];
  items: BizSummary[];
  total: number;
  pageSize: number;
  stats: { businesses: number; actions: number; severe: number; closed: number; topTags: [string, number][] } | null;
  hasData: boolean;
  /** 마지막 수집이 실패했으면 true (빈 화면에서 '잠시 후' 대신 정확한 안내) */
  ingestFailing?: boolean;
  regionLabel: string;
  periodLabel: string;
}) {
  const { q, items, total } = props;
  const searching = q.q.length > 0;
  const pages = Math.ceil(total / props.pageSize);
  const link = (page: number, over: Partial<HygieneQuery> = {}) => {
    const s = { ...q, ...over };
    const u = new URLSearchParams();
    if (s.q) u.set("q", s.q);
    if (s.region) u.set("r", s.region);
    if (s.sev > 1) u.set("sev", String(s.sev));
    if (s.period !== "1y") u.set("p", s.period);
    if (page > 1) u.set("page", String(page));
    return `/hygiene?${u}`;
  };

  return (
    <>
      <h1>우리 동네 식당 위생 체크</h1>
      <p class="lead">
        식당·카페·술집이 위생 규정을 어겨 받은 <b>행정처분 기록</b>을 찾아볼 수 있어요. 가게 이름이나 동네 이름으로
        검색해 보세요.
      </p>
      <SearchForm q={q} regions={props.regions} />

      {!props.hasData ? (
        <div style="margin-top:20px">
          {props.ingestFailing ? (
            <Empty icon="🛠️" title="위생 정보를 아직 받아오지 못했어요">
              <p>식품안전나라 자료를 가져오는 데 문제가 있어 확인하고 있어요.</p>
              <p>
                그동안 <a href="/prices">이번 주 장보기 시세</a>는 바로 볼 수 있어요.
              </p>
            </Empty>
          ) : (
            <Empty icon="⏳" title="아직 위생 정보를 불러오는 중이에요">
              처음 한 번은 전국 자료를 모으는 데 시간이 걸려요. 잠시 후 다시 확인해 주세요.
            </Empty>
          )}
        </div>
      ) : (
        <>
          {!searching && props.stats && (
            <section aria-labelledby="sum-h">
              <h2 id="sum-h">
                {props.regionLabel} · {props.periodLabel} 요약
              </h2>
              <div class="card pad stack">
                <div class="stats">
                  <div class="stat">
                    <div class="v num">{props.stats.businesses.toLocaleString()}</div>
                    <div class="k">처분받은 업소</div>
                  </div>
                  <div class="stat">
                    <div class="v num">{props.stats.severe.toLocaleString()}</div>
                    <div class="k">영업정지 이상</div>
                  </div>
                  <div class="stat">
                    <div class="v num">{props.stats.closed.toLocaleString()}</div>
                    <div class="k">영업취소·폐쇄</div>
                  </div>
                </div>
                {props.stats.topTags.length > 0 && (
                  <div>
                    <div class="small muted" style="margin-bottom:6px">
                      자주 적발된 위반
                    </div>
                    <div class="row">
                      {props.stats.topTags.map(([t, n]) => (
                        <span class="tag">
                          {t} <b class="num">{n}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section aria-labelledby="list-h">
            <h2 id="list-h" class="row">
              <span>
                {searching ? (
                  <>‘{q.q}’ 검색 결과</>
                ) : (
                  <>최근 처분받은 곳</>
                )}
              </span>
              <span class="faint small num" style="font-weight:600">
                {total.toLocaleString()}곳
              </span>
            </h2>
            {items.length === 0 ? (
              searching ? (
                <Empty icon="🙂" title={`‘${q.q}’의 위반 기록이 없어요`}>
                  <p>
                    {props.regionLabel} · {props.periodLabel} 기준으로 공개된 처분 기록이 없어요.
                  </p>
                  <p>
                    상호의 일부만 입력하거나(예: ‘○○김밥 역삼점’ → ‘○○김밥’)
                    {q.period !== "all" || q.region ? (
                      <>
                        {" "}
                        <a href={link(1, { period: "all", region: "" })}>전국 · 전체 기간</a>으로 넓혀 보세요.
                      </>
                    ) : (
                      " 띄어쓰기를 바꿔 보세요."
                    )}
                  </p>
                  <p class="faint">기록이 없다고 해서 점검을 통과했다는 뜻은 아니에요. 공개 기간이 지난 처분은 보이지 않아요.</p>
                </Empty>
              ) : (
                <Empty icon="🌿" title="이 조건에 해당하는 처분이 없어요">
                  지역이나 기간을 바꿔 보세요.
                </Empty>
              )
            ) : (
              <div class="card">
                {items.map((b) => (
                  <BizItem b={b} />
                ))}
              </div>
            )}
            {pages > 1 && (
              <nav class="pager" aria-label="페이지">
                {q.page > 1 && (
                  <a class="btn ghost" href={link(q.page - 1)}>
                    ← 이전
                  </a>
                )}
                <span class="btn ghost" aria-current="page" style="pointer-events:none">
                  {q.page} / {pages}
                </span>
                {q.page < pages && (
                  <a class="btn ghost" href={link(q.page + 1)}>
                    다음 →
                  </a>
                )}
              </nav>
            )}
          </section>

          <section style="margin-top:24px">
            <details class="help card pad">
              <summary>행정처분이 뭔가요? 어떻게 읽으면 되나요?</summary>
              <div class="stack">
                <p>
                  구청 등 관할 기관이 위생 점검에서 법 위반을 확인하면 내리는 조치예요. 무거운 순서로 보면 다음과 같아요.
                </p>
                <p>
                  <SeverityBadge sev={3} /> {SEVERITY_HINT[3]}
                </p>
                <p>
                  <SeverityBadge sev={2} /> {SEVERITY_HINT[2]}
                </p>
                <p>
                  <SeverityBadge sev={1} /> {SEVERITY_HINT[1]}
                </p>
                <p class="muted">
                  처분 사유에는 위생과 직접 관련 없는 것(위생교육 미이수, 청소년 주류 제공 등)도 있으니 위반 내용을 함께
                  확인하세요.
                </p>
              </div>
            </details>
          </section>
        </>
      )}
    </>
  );
}

function mapLinks(name: string, addr: string | null) {
  const qq = encodeURIComponent(`${name} ${addr?.split(" ").slice(0, 3).join(" ") ?? ""}`.trim());
  return [
    { label: "네이버 지도", href: `https://map.naver.com/p/search/${qq}` },
    { label: "카카오맵", href: `https://map.kakao.com/?q=${qq}` },
  ];
}

export function BusinessPage(props: { actions: ActionRow[] }) {
  const a = props.actions;
  const head = a[0];
  const max = Math.max(...a.map((x) => x.severity));
  const allTags = [...new Set(a.flatMap((x) => violationTags(x.violation)))];
  const recent = a.filter((x) => x.action_date && Date.now() - Date.parse(x.action_date) < 365 * 86400_000).length;
  return (
    <>
      <p class="small">
        <a href="/hygiene" class="muted">
          ← 식당 위생 체크
        </a>
      </p>
      <div class="row">
        <h1 style="margin-right:4px">{head.biz_name}</h1>
        {head.biz_type && <span class="tag">{head.biz_type}</span>}
      </div>
      {head.addr && <p class="muted">{head.addr}</p>}
      <div class="row" style="margin:6px 0 16px">
        {mapLinks(head.biz_name, head.addr).map((m) => (
          <a class="chip" href={m.href} target="_blank" rel="noopener noreferrer">
            {m.label}에서 보기 ↗
          </a>
        ))}
      </div>

      <div class={`callout ${max >= 2 ? "warn" : ""}`}>
        <div class="row">
          <SeverityBadge sev={max} />
          <b class="num">
            지금까지 공개된 처분 {a.length}회{recent ? ` (최근 1년 ${recent}회)` : ""}
          </b>
        </div>
        <p style="margin:8px 0 0">
          가장 최근 처분은 <b>{dotDate(head.action_date)}</b>({ago(head.action_date)}) {head.action_type ?? "처분"}
          이에요.
        </p>
        {allTags.length > 0 && (
          <div class="row" style="margin-top:8px">
            {allTags.map((t) => (
              <span class="tag">{t}</span>
            ))}
          </div>
        )}
      </div>

      <h2>처분 기록</h2>
      <ol class="timeline">
        {a.map((x) => (
          <li>
            <span class={`dot s${x.severity}`} aria-hidden="true" />
            <div class="card pad">
              <div class="row">
                <b class="num">{dotDate(x.action_date)}</b>
                <span class="faint small">{ago(x.action_date)}</span>
                <span class="spacer" />
                <SeverityBadge sev={x.severity} label={x.action_type} />
              </div>
              {x.action_detail && <p class="small muted" style="margin-top:6px">{x.action_detail}</p>}
              {x.violation && <p style="margin-top:8px">{x.violation}</p>}
              {x.law && <p class="tiny faint" style="margin-top:6px">근거: {x.law}</p>}
            </div>
          </li>
        ))}
      </ol>
      <p class="small faint">
        상호와 주소가 같은 기록을 한 가게로 묶었어요. 같은 이름의 다른 지점이거나 주인이 바뀐 경우가 섞여 있을 수 있어요.
      </p>
    </>
  );
}
