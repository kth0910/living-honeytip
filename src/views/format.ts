const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export function won(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

/** 2026-11-02 -> 11월 2일(월) */
export function koDate(iso: string | null | undefined, withYear = false): string {
  if (!iso) return "-";
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  const base = `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEKDAY[d.getUTCDay()]})`;
  return withYear ? `${d.getUTCFullYear()}년 ${base}` : base;
}

/** 2026-11-02 -> 2026.11.02 */
export function dotDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return iso.slice(0, 10).replaceAll("-", ".");
}

/** 날짜까지 남은/지난 기간을 사람 말로 */
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

export function pct(r: number | null | undefined, digits = 0): string {
  if (r === null || r === undefined || !Number.isFinite(r)) return "-";
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

export function itemLabel(r: { item_name: string; kind_name: string }): string {
  const kind = r.kind_name?.trim();
  if (!kind || kind === r.item_name || kind === "일반" || kind === "-") return r.item_name;
  // "대파(1kg)"처럼 품종명에 단위가 붙은 경우 괄호 앞만
  const k = kind.replace(/\(.*\)$/, "").trim();
  if (!k || k === r.item_name || /^[\d.]+\s*(kg|g|개|구|마리|포기|L|ml)$/i.test(k)) return r.item_name;
  return k.includes(r.item_name) ? k : `${r.item_name} · ${k}`;
}

/** 받침 유무에 따라 조사 고르기: josa("대파", "이", "가") -> "대파가" */
export function josa(word: string, withFinal: string, withoutFinal: string): string {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}${withFinal}(${withoutFinal})`;
  return word + (code % 28 ? withFinal : withoutFinal);
}
