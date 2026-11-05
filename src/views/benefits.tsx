import type { BenefitDetail, BenefitRow } from "../benefits-data.js";
import { RegionOptions } from "./hygiene.js";
import { koDate, longDate, tidy } from "./format.js";
import { Empty, Icon, Notice, SectionHead, Select, Tile, type IconName } from "./ui.js";

export type BenefitQuery = {
  q: string;
  region: string; // "" | "서울" | "서울 강남구"
  age: number | null;
  field: string; // "" | 분야 원문
  who: string; // "" | 개인 | 가구 | 소상공인
  list: string; // "" 둘러보기 | "popular" | "new" | "local"
  page: number;
  /** 신청 기간이 끝난 혜택도 함께 보기 */
  ended: boolean;
};

/** 분야 이름을 문장에 어울리게 (원문은 '보육·교육'처럼 가운뎃점) */
const FIELD_LABEL: Record<string, string> = {
  생활안정: "생활 안정",
  농림축산어업: "농림축산어업",
  "보육·교육": "보육과 교육",
  "보건·의료": "보건과 의료",
  "임신·출산": "임신과 출산",
  "고용·창업": "고용과 창업",
  "문화·환경": "문화와 환경",
  "행정·안전": "행정과 안전",
  "보호·돌봄": "보호와 돌봄",
  "주거·자립": "주거와 자립",
};
export const fieldLabel = (f: string | null | undefined) => (f ? FIELD_LABEL[f] ?? tidy(f) : "");

const FIELD_ICON: Record<string, IconName> = {
  생활안정: "shield-check",
  농림축산어업: "basket",
  "보육·교육": "doc",
  "보건·의료": "info",
  "임신·출산": "home",
  "고용·창업": "tool",
  "문화·환경": "compass",
  "행정·안전": "alert",
  "보호·돌봄": "user",
  "주거·자립": "home",
};

/** 지원 형태 원문 "현금(감면)"이나 "기타||상담/법률지원" 같은 값을 짧게 */
function supportLabel(t: string | null | undefined): string {
  if (!t) return "";
  const first = t.split("||")[0];
  return tidy(first.replace(/\//g, ", ").replace(/\(([^)]+)\)/, " $1"));
}

export function benefitHref(b: BenefitQuery, over: Partial<BenefitQuery> = {}, page = 1): string {
  const s = { ...b, ...over };
  const u = new URLSearchParams();
  if (s.q) u.set("q", s.q);
  if (s.region) u.set("r", s.region);
  if (s.age !== null && s.age !== undefined) u.set("age", String(s.age));
  if (s.field) u.set("f", s.field);
  if (s.who) u.set("who", s.who);
  if (s.list) u.set("list", s.list);
  if (s.ended) u.set("end", "1");
  if (page > 1) u.set("page", String(page));
  const qs = u.toString();
  return `/benefits${qs ? `?${qs}` : ""}`;
}

export function BenefitRowItem(props: { b: BenefitRow; showRegion?: boolean }) {
  const b = props.b;
  const where = b.sigungu ? `${b.sido} ${b.sigungu}` : b.sido ? `${b.sido} 전체` : "전국";
  return (
    <a class="row" href={`/benefits/${encodeURIComponent(b.id)}`}>
      <div class="main">
        <div class="title">{tidy(b.name)}</div>
        {b.summary && <div class="sub clamp2">{tidy(b.summary)}</div>}
        <div class="labels">
          {b.field && <span class="label plain">{fieldLabel(b.field)}</span>}
          {b.support_type && <span class="label good">{supportLabel(b.support_type)}</span>}
          <span class="label flat">{props.showRegion === false ? tidy(b.agency) : where}</span>
          <DueLabel daysLeft={b.days_left} />
        </div>
      </div>
      <Icon name="chevron-right" class="chev" />
    </a>
  );
}

/** 마감이 2주 안이면 "마감 3일 전", 지났으면 "신청 끝남" */
function DueLabel(props: { daysLeft: number | null }) {
  const n = props.daysLeft;
  if (n === null || n === undefined) return null;
  if (n < 0) return <span class="label sev0">신청 끝남</span>;
  if (n > 14) return null;
  return <span class="label sev2">{n === 0 ? "오늘 마감" : `마감 ${n}일 전`}</span>;
}

/** 끝난 혜택을 뺐다고 알려 주고 같이 보기를 고르게 */
function EndedNote(props: { b: BenefitQuery; n: number }) {
  if (props.n <= 0) return null;
  const { b } = props;
  return (
    <p class="small t3" style="margin:12px 0 0">
      {b.ended ? (
        <>
          신청 기간이 끝난 혜택 {props.n.toLocaleString()}개도 함께 보고 있어요.{" "}
          <a class="t2" style="text-decoration:underline;text-underline-offset:3px" href={benefitHref(b, { ended: false })}>
            빼고 보기
          </a>
        </>
      ) : (
        <>
          신청 기간이 끝난 혜택 {props.n.toLocaleString()}개는 뺐어요.{" "}
          <a class="t2" style="text-decoration:underline;text-underline-offset:3px" href={benefitHref(b, { ended: true })}>
            같이 보기
          </a>
        </>
      )}
    </p>
  );
}

function Rows(props: { items: BenefitRow[] }) {
  return (
    <ul class="rows">
      {props.items.map((b) => (
        <li>
          <BenefitRowItem b={b} />
        </li>
      ))}
    </ul>
  );
}

const AGES: { label: string; age: number | null }[] = [
  { label: "모든 나이", age: null },
  { label: "10대", age: 10 },
  { label: "20대", age: 20 },
  { label: "30대", age: 30 },
  { label: "40대", age: 40 },
  { label: "50대", age: 50 },
  { label: "60대", age: 60 },
  { label: "70대 이상", age: 70 },
];

/** "서울 마포구에 사는 30대라면", "서울 마포구에 살면", "30대라면", "지금" */
function headline(region: string, ageLabel: string): string {
  if (region && ageLabel) return `${region}에 사는 ${ageLabel}라면`;
  if (region) return `${region}에 살면`;
  if (ageLabel) return `${ageLabel}라면`;
  return "지금";
}

function Filters(props: { b: BenefitQuery; regions: { sido: string; sigungu: string | null; n: number }[]; fields: { field: string; n: number }[] }) {
  const { b } = props;
  return (
    <div class="card">
      <form action="/benefits" method="get">
        {b.q && <input type="hidden" name="q" value={b.q} />}
        {b.field && <input type="hidden" name="f" value={b.field} />}
        {b.who && <input type="hidden" name="who" value={b.who} />}
        {b.list && <input type="hidden" name="list" value={b.list} />}
        {b.ended && <input type="hidden" name="end" value="1" />}
        <div class="pair">
          <div>
            <div class="filter-label">사는 곳</div>
            <Select name="r" label="사는 곳" autosubmit>
              <RegionOptions regions={props.regions} value={b.region} allLabel="전국" />
            </Select>
          </div>
          <div>
            <div class="filter-label">나이</div>
            <Select name="age" label="나이" autosubmit>
              {AGES.map((a) => (
                <option value={a.age === null ? "" : String(a.age)} selected={a.age === b.age}>
                  {a.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <noscript>
          <button class="btn secondary small" type="submit" style="margin-top:8px">
            적용
          </button>
        </noscript>
      </form>
      <div class="filter-group">
        <div class="filter-label">분야</div>
        <div class="chips scroll" role="group" aria-label="분야">
          <a class="chip" href={benefitHref(b, { field: "" })} aria-current={!b.field ? "true" : undefined}>
            전체
          </a>
          {props.fields.map((f) => (
            <a class="chip" href={benefitHref(b, { field: f.field })} aria-current={b.field === f.field ? "true" : undefined}>
              {fieldLabel(f.field)}
            </a>
          ))}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-label">받는 사람</div>
        <div class="chips scroll" role="group" aria-label="받는 사람">
          {[
            ["", "누구나"],
            ["개인", "나"],
            ["가구", "우리 가족"],
            ["소상공인", "가게 사장님"],
          ].map(([v, label]) => (
            <a class="chip" href={benefitHref(b, { who: v })} aria-current={b.who === v ? "true" : undefined}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BenefitsPage(props: {
  b: BenefitQuery;
  regions: { sido: string; sigungu: string | null; n: number }[];
  fields: { field: string; n: number }[];
  counts: { total: number; local: number; recent: number; ended: number };
  /** 둘러보기 화면의 묶음들 */
  popular?: BenefitRow[];
  fresh?: BenefitRow[];
  local?: BenefitRow[];
  /** 목록 화면 */
  list?: { items: BenefitRow[]; total: number };
  pageSize: number;
  hasData: boolean;
}) {
  const { b } = props;
  const regionLabel = b.region || "전국";
  const browsing = !props.list;
  const title =
    b.list === "new" ? "새로 생긴 혜택" : b.list === "local" ? `${regionLabel} 혜택` : b.q ? `‘${b.q}’ 혜택` : "많이 찾는 혜택";
  return (
    <>
      <h1 class="page-title">나에게 맞는 혜택</h1>
      <p class="page-sub">정부와 지자체, 공공기관이 주는 지원금과 혜택을 사는 곳과 나이에 맞춰 찾아 드려요.</p>
      <form action="/benefits" method="get" role="search">
        <label class="search" for="bq">
          <Icon name="search" />
          <span class="sr-only">혜택 찾기</span>
          <input id="bq" type="search" name="q" value={b.q} placeholder="예: 월세, 출산, 청년, 전기요금" autocomplete="off" enterkeyhint="search" />
        </label>
        {b.region && <input type="hidden" name="r" value={b.region} />}
        {b.age !== null && <input type="hidden" name="age" value={String(b.age)} />}
        {b.ended && <input type="hidden" name="end" value="1" />}
      </form>

      {!props.hasData ? (
        <div class="card">
          <Empty icon="clock" title="아직 혜택 정보를 불러오는 중이에요">
            <p>잠시 후 다시 확인해 주세요.</p>
          </Empty>
        </div>
      ) : (
        <>
          <Filters b={b} regions={props.regions} fields={props.fields} />

          {browsing ? (
            <>
              <section class="card">
                <p class="strong" style="font-size:19px;line-height:1.45">
                  {headline(b.region ? regionLabel : "", AGES.find((a) => a.age !== null && a.age === b.age)?.label ?? "")} 받을 수 있는
                  혜택이{" "}
                  <span class="num" style="color:var(--brand)">
                    {props.counts.total.toLocaleString()}개
                  </span>{" "}
                  있어요.
                </p>
                <div class="labels" style="margin-top:12px">
                  {b.region && <span class="label good">우리 동네 혜택 {props.counts.local.toLocaleString()}개</span>}
                  <span class="label plain">최근 60일 새 혜택 {props.counts.recent.toLocaleString()}개</span>
                </div>
                <EndedNote b={b} n={props.counts.ended} />
              </section>

              {props.local && props.local.length > 0 && (
                <section class="card flush" aria-labelledby="bl-h">
                  <SectionHead id="bl-h" title={`${regionLabel}에서 주는 혜택`} more={{ href: benefitHref(b, { list: "local" }), label: "모두 보기" }} />
                  <Rows items={props.local} />
                </section>
              )}
              {props.popular && props.popular.length > 0 && (
                <section class="card flush" aria-labelledby="bp-h">
                  <SectionHead id="bp-h" title="많이 찾는 혜택" more={{ href: benefitHref(b, { list: "popular" }), label: "모두 보기" }} />
                  <Rows items={props.popular} />
                </section>
              )}
              {props.fresh && props.fresh.length > 0 && (
                <section class="card flush" aria-labelledby="bn-h">
                  <SectionHead id="bn-h" title="새로 생긴 혜택" more={{ href: benefitHref(b, { list: "new" }), label: "모두 보기" }} />
                  <Rows items={props.fresh} />
                </section>
              )}
            </>
          ) : (
            <section class="card flush" aria-labelledby="blist-h">
              <SectionHead
                id="blist-h"
                title={
                  <>
                    {title}{" "}
                    <span class="t3 num" style="font-size:16px;font-weight:600">
                      {props.list!.total.toLocaleString()}개
                    </span>
                  </>
                }
                more={b.list || b.q ? { href: benefitHref(b, { list: "", q: "" }), label: "둘러보기" } : undefined}
              />
              {props.list!.items.length === 0 ? (
                <Empty icon="gift" title="조건에 맞는 혜택이 없어요">
                  <p>나이나 분야를 넓히거나, 다른 말로 찾아보세요.</p>
                </Empty>
              ) : (
                <Rows items={props.list!.items} />
              )}
              <Pager b={b} total={props.list!.total} pageSize={props.pageSize} />
              <div style="padding:0 20px 16px">
                <EndedNote b={b} n={props.counts.ended} />
              </div>
            </section>
          )}

          <p class="small t3" style="margin:12px 4px 0">
            행정안전부 공공서비스(혜택) 정보를 매일 받아와요. 실제 대상 여부와 신청은 정부24나 담당 기관에서 확인해 주세요.
          </p>
        </>
      )}
    </>
  );
}

function Pager(props: { b: BenefitQuery; total: number; pageSize: number }) {
  const pages = Math.ceil(props.total / props.pageSize);
  if (pages <= 1) return null;
  const { b } = props;
  return (
    <nav class="pager" aria-label="페이지">
      {b.page > 1 && (
        <a class="btn secondary small" href={benefitHref(b, {}, b.page - 1)} aria-label="이전 페이지">
          <Icon name="chevron-left" />
          이전
        </a>
      )}
      <span class="t3 small num">
        {b.page} / {pages}
      </span>
      {b.page < pages && (
        <a class="btn secondary small" href={benefitHref(b, {}, b.page + 1)} aria-label="다음 페이지">
          다음
          <Icon name="chevron-right" />
        </a>
      )}
    </nav>
  );
}

/** 원문의 ○, -, ㆍ, ※ 같은 글머리를 떼고 줄 단위 목록으로 */
function TextBlock(props: { text: string | null }) {
  if (!props.text) return <p class="t3">정보 없음</p>;
  const lines = props.text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[○●◦•ㆍ·∙\-–—*※▶▷►]+|\d+\)|[①-⑳])\s*/, "").trim())
    .map((l) => tidy(l))
    .filter(Boolean);
  if (lines.length <= 1) return <p class="t2 pre">{lines[0] ?? ""}</p>;
  return (
    <ul class="bullets">
      {lines.map((l) => (
        <li>{l}</li>
      ))}
    </ul>
  );
}

export function BenefitDetailPage(props: { d: BenefitDetail }) {
  const d = props.d;
  const where = d.sigungu ? `${d.sido} ${d.sigungu}` : d.sido ? `${d.sido} 전체` : "전국";
  const age =
    d.age_min !== null && d.age_max !== null && !(d.age_min <= 0 && d.age_max >= 100)
      ? `${d.age_min}세부터 ${d.age_max}세까지`
      : null;
  const over = d.days_left !== null && d.days_left < 0;
  return (
    <>
      <a class="small t3" href="/benefits" style="display:inline-flex;align-items:center;gap:2px;margin-top:8px">
        <Icon name="chevron-left" />
        혜택
      </a>
      <section class="card">
        <div style="display:flex;gap:12px;align-items:center">
          <Tile icon={FIELD_ICON[d.field ?? ""] ?? "gift"} color="green" />
          <div class="t3 small">
            {fieldLabel(d.field)}
            {d.field ? ", " : ""}
            {tidy(d.agency)}
          </div>
        </div>
        <h1 class="page-title" style="margin:12px 0 6px">
          {tidy(d.name)}
        </h1>
        {d.summary && <p class="t2">{tidy(d.summary)}</p>}
        <div class="labels" style="margin-top:12px">
          {d.support_type && <span class="label good">{supportLabel(d.support_type)}</span>}
          <span class="label plain">{where}</span>
          {age && <span class="label plain">{age}</span>}
          {!over && <DueLabel daysLeft={d.days_left} />}
        </div>
        {over && (
          <div style="margin-top:16px">
            <Notice icon="clock" tone="warn">
              신청 기간이 끝났어요. {longDate(d.apply_end!)}까지였어요. 다시 모집하는지는 담당 기관에 물어보세요.
            </Notice>
          </div>
        )}
        {d.url && (
          <a class={over ? "btn secondary block" : "btn block"} href={d.url} target="_blank" rel="noopener noreferrer" style="margin-top:16px">
            {over ? "정부24에서 자세히 보기" : "정부24에서 자세히 보고 신청하기"}
            <Icon name="external" />
          </a>
        )}
      </section>

      <section class="card">
        <SectionHead title="무엇을 받나요" />
        <TextBlock text={d.content} />
      </section>
      <section class="card">
        <SectionHead title="누가 받을 수 있나요" />
        <TextBlock text={d.target} />
        {d.criteria && (
          <details class="more-info" style="margin-top:14px">
            <summary>
              <Icon name="doc" />
              선정 기준 자세히
              <Icon name="chevron-down" />
            </summary>
            <div class="body">
              <TextBlock text={d.criteria} />
            </div>
          </details>
        )}
      </section>
      <section class="card">
        <SectionHead title="어떻게 신청하나요" />
        <ul class="kv">
          <li>
            <span class="k">신청 방법</span>
            <span class="v">{tidy(d.apply_method) || "정보 없음"}</span>
          </li>
          <li>
            <span class="k">신청 기간</span>
            <span class="v">{tidy(d.deadline) || "정보 없음"}</span>
          </li>
          <li>
            <span class="k">접수하는 곳</span>
            <span class="v">{tidy(d.receiver) || "정보 없음"}</span>
          </li>
          <li>
            <span class="k">문의</span>
            <span class="v">{tidy(d.contact) || "정보 없음"}</span>
          </li>
        </ul>
      </section>
      <Notice icon="info">
        {d.modified_at ? `${longDate(d.modified_at.slice(0, 10))}에 마지막으로 바뀐 정보예요. ` : ""}
        조건은 바뀔 수 있으니 신청 전에 담당 기관에서 꼭 확인해 주세요.
      </Notice>
      {d.registered_at && <p class="tiny t3" style="margin:10px 4px 0">{koDate(d.registered_at.slice(0, 10), { year: true, weekday: false })}에 처음 등록</p>}
    </>
  );
}
