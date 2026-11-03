const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export function won(n: number | null | undefined): string {
  if (n === null || n === undefined) return "정보 없음";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function parts(iso: string) {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), w: WEEKDAY[d.getUTCDay()] };
}

/** 2026-11-02 -> 11월 2일 월요일 */
export function koDate(iso: string | null | undefined, opts: { year?: boolean; weekday?: boolean } = {}): string {
  if (!iso) return "날짜 정보 없음";
  const p = parts(iso);
  const base = `${p.m}월 ${p.d}일`;
  return `${opts.year ? `${p.y}년 ` : ""}${base}${opts.weekday === false ? "" : ` ${p.w}요일`}`;
}

/** 2026-11-02 -> 2026년 11월 2일 */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return "날짜 정보 없음";
  const p = parts(iso);
  return `${p.y}년 ${p.m}월 ${p.d}일`;
}

/** 2026-11-02 -> 26.11.02 (그래프 축처럼 좁은 곳) */
export function shortDate(iso: string): string {
  const p = parts(iso);
  return `${String(p.y).slice(2)}.${String(p.m).padStart(2, "0")}.${String(p.d).padStart(2, "0")}`;
}

/** 처분 기간을 말로: "11월 1일부터 7일까지, 7일 동안" */
export function periodText(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const a = parts(start);
  if (!end) return `${a.m}월 ${a.d}일부터`;
  const b = parts(end);
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400_000) + 1;
  const endText = a.y !== b.y ? `${b.y}년 ${b.m}월 ${b.d}일` : a.m !== b.m ? `${b.m}월 ${b.d}일` : `${b.d}일`;
  const head = `${a.y !== b.y ? `${a.y}년 ` : ""}${a.m}월 ${a.d}일부터 ${endText}까지`;
  return days > 1 ? `${head}, ${days}일 동안` : head;
}

/** 날짜까지 지난 기간을 사람 말로 */
export function ago(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const then = Date.parse(iso.length <= 10 ? iso + "T00:00:00+09:00" : iso);
  const days = Math.floor((now.getTime() - then) / 86400_000);
  if (days < 1) return "오늘";
  if (days < 7) return `${days}일 전`;
  if (days < 31) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return m ? `${y}년 ${m}개월 전` : `${y}년 전`;
}

export function agoTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const mins = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/** 등락률 절댓값을 %로 */
export function pct(r: number | null | undefined, digits = 0): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return "";
  const v = Math.abs(r * 100);
  const s = v < 1 && v > 0 ? v.toFixed(1) : v.toFixed(digits);
  return `${s}%`;
}

export type Trend = "up" | "down" | "flat" | "none";

export function trendOf(r: number | null | undefined, threshold = 0.03): Trend {
  if (r === null || r === undefined || !Number.isFinite(r)) return "none";
  if (r >= threshold) return "up";
  if (r <= -threshold) return "down";
  return "flat";
}

const UNIT_ONLY = /^[\d.]+\s*(kg|g|개|구|마리|포기|L|ml)$/i;

/** 품종 이름 (품목 이름과 같거나 단위뿐이면 빈 문자열) */
export function kindName(r: { item_name: string; kind_name: string }): string {
  const kind = r.kind_name?.trim();
  if (!kind || kind === r.item_name || kind === "일반" || kind === "-") return "";
  let k = kind.replace(/\(\s*[\d.]+\s*(kg|g|개|구|마리|포기|L|ml)\s*\)$/i, "").trim();
  // "20kg(햅쌀)"처럼 단위 뒤 괄호에 품종이 있으면 품종만 쓴다 (단위는 따로 보여 줌)
  const m = k.match(/^[\d.]+\s*(kg|g|개|구|마리|포기|L|ml)\s*\((.+)\)$/i);
  if (m) k = m[2].trim();
  if (!k || k === r.item_name || UNIT_ONLY.test(k)) return "";
  return k;
}

/** 목록 제목: "배추", 품종이 있으면 "배추 가을" */
export function itemTitle(r: { item_name: string; kind_name: string }): string {
  const k = tidy(kindName(r));
  const name = tidy(r.item_name);
  if (!k) return name;
  return k.includes(name) ? k : `${name} ${k}`;
}

/** 등급 표시: 의미 없는 값("-")이나 품종과 같은 값은 숨긴다 */
export function rankLabel(r: { rank_name: string; kind_name: string }): string {
  const g = r.rank_name?.trim();
  if (!g || g === "-" || g === r.kind_name?.trim()) return "";
  return g;
}

/** 목록 보조 줄: "1포기, 상품" */
export function itemSub(r: { unit: string; rank_name: string; kind_name: string }): string {
  return [tidy(r.unit), tidy(rankLabel(r))].filter(Boolean).join(", ");
}

/** 받침 유무에 따라 조사 고르기: josa("대파", "이", "가") -> "대파가" */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}${withFinal}`;
  return word + (code % 28 ? withFinal : withoutFinal);
}

/** "(20261006)영업장 면적 변경..." -> { date: "2026-10-06", text: "영업장 면적 변경..." } */
export function splitViolation(v: string): { date: string | null; text: string } {
  const m = v.match(/^\s*\(?(\d{4})[.\-]?(\d{2})[.\-]?(\d{2})\)?\s*/);
  if (!m) return { date: null, text: v };
  return { date: `${m[1]}-${m[2]}-${m[3]}`, text: v.slice(m[0].length) || v };
}

/** 공공데이터 원문을 화면 규칙에 맞게 다듬는다: 가운뎃점과 대시는 쉼표로 */
export function tidy(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\s*[·ㆍ‧∙•]\s*/g, ", ")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/,\s*,/g, ",")
    .trim();
}
