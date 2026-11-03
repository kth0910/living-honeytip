import type { ActionRow, BizSummary, RegionCount } from "../data.js";
import { SEVERITY_HINT, SEVERITY_LABEL, violationTags } from "../lib/severity.js";
import { SIDO_ORDER } from "../lib/region.js";
import { ago, koDate, longDate, periodText, splitViolation } from "./format.js";
import { Empty, Icon, Notice, SectionHead, Select, type IconName } from "./ui.js";

export type HygieneQuery = {
  q: string;
  region: string; // "" | "서울" | "서울 강남구"
  sev: number; // 0 폐업 정리 포함 | 1 위생 처분 전체 | 2 영업정지 이상 | 3 영업취소만
  period: string; // "1y" | "3y" | "all"
  scope: string; // "eat" 식당과 카페 | "all" 모든 식품업소
  page: number;
};

const SEV_ICON: Record<number, IconName> = { 3: "alert", 2: "alert", 1: "info", 0: "archive" };

export function SeverityBadge(props: { sev: number; label?: string | null }) {
  return (
    <span class={`label sev${props.sev}`} title={SEVERITY_HINT[props.sev]}>
      <Icon name={SEV_ICON[props.sev] ?? "info"} />
      {props.label || SEVERITY_LABEL[props.sev]}
    </span>
  );
}

export function hygieneHref(q: HygieneQuery, over: Partial<HygieneQuery> = {}, page = 1): string {
  const s = { ...q, ...over };
  const u = new URLSearchParams();
  if (s.q) u.set("q", s.q);
  if (s.region) u.set("r", s.region);
  u.set("sev", String(s.sev));
  u.set("k", s.scope);
  u.set("p", s.period);
  if (page > 1) u.set("page", String(page));
  return `/hygiene?${u}`;
}

export function RegionOptions(props: { regions: RegionCount[]; value: string; allLabel?: string }) {
  const bySido = new Map<string, RegionCount[]>();
  for (const r of props.regions) {
    if (!bySido.has(r.sido)) bySido.set(r.sido, []);
    if (r.sigungu) bySido.get(r.sido)!.push(r);
  }
  const sidos = [...bySido.keys()].sort((a, b) => SIDO_ORDER.indexOf(a) - SIDO_ORDER.indexOf(b));
  return (
    <>
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
                {v}
              </option>
            );
          })}
        </optgroup>
      ))}
    </>
  );
}

function Chips(props: { label: string; items: { label: string; href: string; on: boolean }[] }) {
  return (
    <div class="filter-group">
      <div class="filter-label">{props.label}</div>
      <div class="chips" role="group" aria-label={props.label}>
        {props.items.map((it) => (
          <a class="chip" href={it.href} aria-current={it.on ? "true" : undefined}>
            {it.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function Filters(props: { q: HygieneQuery; regions: RegionCount[] }) {
  const { q } = props;
  return (
    <div class="card">
      <form action="/hygiene" method="get">
        {q.q && <input type="hidden" name="q" value={q.q} />}
        <input type="hidden" name="sev" value={String(q.sev)} />
        <input type="hidden" name="k" value={q.scope} />
        <input type="hidden" name="p" value={q.period} />
        <div class="filter-group">
          <div class="filter-label">동네</div>
          <Select name="r" label="동네" autosubmit>
            <RegionOptions regions={props.regions} value={q.region} />
          </Select>
          <noscript>
            <button class="btn secondary small" type="submit" style="margin-top:8px">
              이 동네로 보기
            </button>
          </noscript>
        </div>
      </form>
      <Chips
        label="처분"
        items={[
          { label: "위생 처분 전체", href: hygieneHref(q, { sev: 1 }), on: q.sev === 1 },
          { label: "영업정지 이상", href: hygieneHref(q, { sev: 2 }), on: q.sev === 2 },
          { label: "영업취소만", href: hygieneHref(q, { sev: 3 }), on: q.sev === 3 },
          { label: "폐업 정리 포함", href: hygieneHref(q, { sev: 0 }), on: q.sev === 0 },
        ]}
      />
      <Chips
        label="업소"
        items={[
          { label: "식당과 카페", href: hygieneHref(q, { scope: "eat" }), on: q.scope === "eat" },
          { label: "모든 식품업소", href: hygieneHref(q, { scope: "all" }), on: q.scope === "all" },
        ]}
      />
      <Chips
        label="기간"
        items={[
          { label: "최근 1년", href: hygieneHref(q, { period: "1y" }), on: q.period === "1y" },
          { label: "최근 3년", href: hygieneHref(q, { period: "3y" }), on: q.period === "3y" },
          { label: "전체", href: hygieneHref(q, { period: "all" }), on: q.period === "all" },
        ]}
      />
    </div>
  );
}

export function SearchBox(props: { value?: string; region?: string; placeholder?: string; id?: string }) {
  const id = props.id ?? "hq";
  return (
    <form action="/hygiene" method="get" role="search">
      <label class="search" for={id}>
        <Icon name="search" />
        <span class="sr-only">가게 이름이나 동네</span>
        <input
          id={id}
          type="search"
          name="q"
          value={props.value ?? ""}
          placeholder={props.placeholder ?? "가게 이름이나 동네로 찾기"}
          autocomplete="off"
          enterkeyhint="search"
        />
      </label>
      {props.region && <input type="hidden" name="r" value={props.region} />}
    </form>
  );
}

export function BizRow(props: { b: BizSummary }) {
  const b = props.b;
  const tags = violationTags(b.last_violation).filter((t) => t !== "폐업 정리");
  const text = b.last_violation ? splitViolation(b.last_violation).text : "";
  return (
    <a class="row" href={`/hygiene/b/${b.biz_key}`}>
      <div class="main">
        <div class="title">{b.biz_name}</div>
        <div class="sub">
          {[b.biz_type, b.addr].filter(Boolean).join(", ")}
        </div>
        <div class="labels">
          <SeverityBadge sev={b.max_severity} />
          {tags.length > 0
            ? tags.map((t) => <span class="label plain">{t}</span>)
            : b.max_severity > 0 && text && <span class="label plain clip">{text}</span>}
        </div>
        <div class="tiny t3" style="margin-top:8px">
          {b.actions > 1 ? `처분 ${b.actions}번, 마지막 ` : "처분일 "}
          {koDate(b.last_date, { weekday: false })} ({ago(b.last_date)})
        </div>
      </div>
      <Icon name="chevron-right" class="chev" />
    </a>
  );
}

export function HygienePage(props: {
  q: HygieneQuery;
  regions: RegionCount[];
  items: BizSummary[];
  total: number;
  pageSize: number;
  stats: {
    businesses: number;
    actions: number;
    severe: number;
    recent30: number;
    closed: number;
    adminClosed: number;
    topTags: [string, number][];
  } | null;
  hasData: boolean;
  ingestFailing?: boolean;
  regionLabel: string;
  periodLabel: string;
}) {
  const { q, items, total } = props;
  const searching = q.q.length > 0;
  const pages = Math.ceil(total / props.pageSize);

  return (
    <>
      <h1 class="page-title">우리 동네 식당 위생</h1>
      <p class="page-sub">위생 규정을 어겨 행정처분을 받은 식당과 카페를 찾아볼 수 있어요.</p>
      <SearchBox value={q.q} region={q.region} />

      {!props.hasData ? (
        <div class="card">
          {props.ingestFailing ? (
            <Empty icon="tool" title="위생 정보를 아직 받아오지 못했어요">
              <p>식품안전나라 자료를 가져오는 데 문제가 있어 확인하고 있어요.</p>
              <p>
                그동안 <a href="/prices">이번 주 장보기 시세</a>는 바로 볼 수 있어요.
              </p>
            </Empty>
          ) : (
            <Empty icon="clock" title="아직 위생 정보를 불러오는 중이에요">
              <p>처음 한 번은 전국 자료를 모으는 데 시간이 걸려요. 잠시 후 다시 확인해 주세요.</p>
            </Empty>
          )}
        </div>
      ) : (
        <>
          <Filters q={q} regions={props.regions} />

          {!searching && props.stats && (
            <section class="card" aria-labelledby="sum-h">
              <SectionHead id="sum-h" title={`${props.regionLabel} ${props.periodLabel} 요약`} />
              <div class="stats">
                <div class="stat">
                  <div class="v num">{props.stats.businesses.toLocaleString()}</div>
                  <div class="k">처분받은 곳</div>
                </div>
                <div class="stat">
                  <div class="v num">{props.stats.recent30.toLocaleString()}</div>
                  <div class="k">최근 30일 새 처분</div>
                </div>
                <div class="stat">
                  <div class="v num">{props.stats.closed.toLocaleString()}</div>
                  <div class="k">영업취소</div>
                </div>
              </div>
              {props.stats.topTags.length > 0 && (
                <div style="margin-top:16px">
                  <div class="filter-label">자주 적발된 위반</div>
                  <div class="labels" style="margin-top:0">
                    {props.stats.topTags.map(([t, n]) => (
                      <span class="label plain">
                        {t} <span class="num t3">{n}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {props.stats.adminClosed > 0 && q.sev >= 1 && (
                <div style="margin-top:16px">
                  <Notice icon="archive">
                    이미 문을 닫아 서류상 정리된 가게 {props.stats.adminClosed.toLocaleString()}곳은 위생과 관련이 없어서
                    목록에서 뺐어요. <a href={hygieneHref(q, { sev: 0 })}>함께 보기</a>
                  </Notice>
                </div>
              )}
            </section>
          )}

          <section class="card flush" aria-labelledby="list-h">
            <SectionHead
              id="list-h"
              title={
                <>
                  {searching ? <>‘{q.q}’ 검색 결과</> : <>최근 처분받은 곳</>}{" "}
                  <span class="t3 num" style="font-size:16px;font-weight:600">
                    {total.toLocaleString()}곳
                  </span>
                </>
              }
            />
            {items.length === 0 ? (
              searching ? (
                <Empty icon="shield-check" color="green" title={`‘${q.q}’의 처분 기록이 없어요`}>
                  <p>
                    {props.regionLabel}, {props.periodLabel} 기준으로 공개된 처분 기록이 없어요.
                  </p>
                  <p>
                    {q.period !== "all" || q.region ? (
                      <>
                        상호를 줄여서 찾거나 <a href={hygieneHref(q, { period: "all", region: "", sev: 0 })}>전국 전체 기간</a>
                        으로 넓혀 보세요.
                      </>
                    ) : (
                      "상호를 줄이거나 띄어쓰기를 바꿔 보세요."
                    )}
                  </p>
                  <p class="t3 small">기록이 없다고 해서 점검을 통과했다는 뜻은 아니에요. 공개 기간이 지난 처분은 보이지 않아요.</p>
                </Empty>
              ) : (
                <Empty icon="shield-check" color="green" title="이 조건에 맞는 처분이 없어요">
                  <p>동네나 기간을 바꿔 보세요.</p>
                </Empty>
              )
            ) : (
              <ul class="rows">
                {items.map((b) => (
                  <li>
                    <BizRow b={b} />
                  </li>
                ))}
              </ul>
            )}
            {pages > 1 && (
              <nav class="pager" aria-label="페이지">
                {q.page > 1 && (
                  <a class="btn secondary small" href={hygieneHref(q, {}, q.page - 1)} aria-label="이전 페이지">
                    <Icon name="chevron-left" />
                    이전
                  </a>
                )}
                <span class="t3 small num">
                  {q.page} / {pages}
                </span>
                {q.page < pages && (
                  <a class="btn secondary small" href={hygieneHref(q, {}, q.page + 1)} aria-label="다음 페이지">
                    다음
                    <Icon name="chevron-right" />
                  </a>
                )}
              </nav>
            )}
          </section>

          <section class="card">
            <details class="more-info">
              <summary>
                <Icon name="info" />
                행정처분은 어떻게 읽으면 되나요
                <Icon name="chevron-down" />
              </summary>
              <div class="body stack">
                <p class="t2">구청 같은 관할 기관이 위생 점검에서 법 위반을 확인하면 내리는 조치예요. 무거운 순서로 보면 이래요.</p>
                {[3, 2, 1, 0].map((s) => (
                  <div style="display:flex;gap:10px;align-items:flex-start">
                    <SeverityBadge sev={s} />
                    <span class="small t2">{SEVERITY_HINT[s]}</span>
                  </div>
                ))}
                <p class="small t3">
                  처분 사유에는 위생교육을 받지 않았거나 청소년에게 술을 판 경우처럼 음식 위생과 직접 관련이 없는 것도 있으니
                  위반 내용을 함께 확인하세요.
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
  const allTags = [...new Set(a.flatMap((x) => violationTags(x.violation)))].filter((t) => t !== "폐업 정리");
  const recent = a.filter((x) => x.action_date && Date.now() - Date.parse(x.action_date) < 365 * 86400_000).length;
  return (
    <>
      <a class="small t3" href="/hygiene" style="display:inline-flex;align-items:center;gap:2px;margin-top:8px">
        <Icon name="chevron-left" />
        식당 위생
      </a>
      <section class="card">
        <div class="t3 small">{head.biz_type}</div>
        <h1 class="page-title" style="margin:2px 0 8px">
          {head.biz_name}
        </h1>
        {head.addr && (
          <p class="t2" style="display:flex;gap:6px;align-items:flex-start">
            <Icon name="pin" class="t3" />
            <span>{head.addr}</span>
          </p>
        )}
        <div class="btn-row" style="margin-top:16px">
          {mapLinks(head.biz_name, head.addr).map((m) => (
            <a class="btn secondary small" href={m.href} target="_blank" rel="noopener noreferrer">
              {m.label}
              <Icon name="external" />
            </a>
          ))}
        </div>
      </section>

      <section class="card">
        {max === 0 ? (
          <Notice icon="shield-check" tone="good">
            <b>위생 위반 기록은 없어요.</b> 이미 문을 닫아 서류상 정리된 기록만 있어요.
          </Notice>
        ) : (
          <>
            <SeverityBadge sev={max} />
            <p class="strong" style="font-size:19px;margin-top:10px;line-height:1.45">
              공개된 처분이 {a.length}번 있어요{recent ? `. 최근 1년 동안 ${recent}번이에요.` : "."}
            </p>
            <p class="t2" style="margin-top:4px">
              가장 최근은 {longDate(head.action_date)} {head.action_type ?? "처분"}이에요.
            </p>
            {allTags.length > 0 && (
              <div class="labels">
                {allTags.map((t) => (
                  <span class="label plain">{t}</span>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section class="card flush">
        <SectionHead title="처분 기록" />
        <ol class="history">
          {a.map((x) => {
            const v = x.violation ? splitViolation(x.violation) : null;
            const period = periodText(x.period_start, x.period_end);
            return (
              <li>
                <div class="when">
                  <span class="date num">{longDate(x.action_date)}</span>
                  <SeverityBadge sev={x.severity} label={x.action_type} />
                </div>
                {(x.action_detail || period) && (
                  <p class="period">
                    {[x.action_detail && x.action_detail !== x.action_type ? x.action_detail : null, period]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
                {v && (
                  <p class="what">
                    {v.date && <span class="t3 small">{koDate(v.date, { weekday: false })} 적발 </span>}
                    {v.text}
                  </p>
                )}
                {x.law && <p class="law">근거 {x.law}</p>}
              </li>
            );
          })}
        </ol>
      </section>
      <p class="small t3" style="margin:12px 4px 0">
        상호와 주소가 같은 기록을 한 가게로 묶었어요. 이름이 같은 다른 지점이거나 주인이 바뀐 경우가 섞여 있을 수 있어요.
      </p>
    </>
  );
}
