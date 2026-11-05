/**
 * 공공서비스 '신청기한' 글에서 신청이 끝나는 날을 뽑는다.
 *
 * 원문은 자유 형식이다: "2025.09.15~2025.12.31", "'26. 3. 18. ~ 4. 6.", "2025년 2~4월중",
 * "(1차) 2026년 5월 22일~6월 22일 (2차) ...", "상시신청", "매년 1~2월", "2025-07-14 ~ 예산소진 시까지".
 *
 * 잘못 숨기는 것이 놓치는 것보다 나쁘므로 보수적으로 판단한다.
 * - 매년, 상시, 예산 소진까지처럼 끝이 열려 있으면 null (끝을 모름)
 * - 날짜를 하나도 못 찾으면 null
 * - 찾은 날짜 중 가장 늦은 날을 끝나는 날로 본다. 월까지만 있으면 그 달 말일, 연도만 있으면 그해 말일.
 */
const OPEN =
  /매\s*년|매\s*월|전년도|연\s*\d+\s*회|매\s*달|매\s*분기|매\s*학기|연중|상시|수시|소진|부터|추후|별도\s*공고|공고\s*시|연도별|해마다|분기별|월별/;
/** "~" 뒤에 날짜가 없으면 끝이 열린 기간 ("2025.01.23.~", "2025-07-14 ~ 예산소진 시까지") */
const OPEN_TILDE = /~\s*(?:$|[(（](?!\s*['\d])|[^\s\d'(（])/;

// 연도: 2026, '26, 26년
// 월(일): 1. / 1월 / 01- / 1월 2일 / 1.2. / 1-16
const TOKEN =
  /(?:(20\d{2})|'(\d{2})|(?<![\d.])(\d{2})(?=\s*년))(?:\s*년도?)?|(?<!\d)(\d{1,2})\s*(월|\.|-|\/)\s*(?:(\d{1,2})(?!\d)\s*(?:일|\.)?)?/g;

function lastDay(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function applyEnd(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text
    .replace(/[’‘`´]/g, "'")
    .replace(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/g, "$1.$2.$3") // 20250901
    .replace(/\s+/g, " ")
    .trim();
  if (OPEN.test(t) || OPEN_TILDE.test(t)) return null;

  let year: number | null = null;
  let yearOnly: number | null = null; // 연도만 나오고 월이 따라오지 않은 경우
  let prev = null as string | null;
  let best = null as string | null;
  const take = (d: string, isPrev = true) => {
    if (!best || d > best) best = d;
    if (isPrev) prev = d;
  };

  for (const m of t.matchAll(TOKEN)) {
    const y4 = m[1] ?? (m[2] ? `20${m[2]}` : m[3] ? `20${m[3]}` : null);
    if (y4) {
      // "'27년도 신규 없음('28년도 종료)" 처럼 연도만 이어지면 앞 연도는 그해 말일까지.
      // "(2026년 2학기) (1차) 2026년 5월" 처럼 같은 해가 다시 나오면 무시.
      if (yearOnly !== null && yearOnly !== Number(y4)) take(iso(yearOnly, 12, 31), false);
      year = Number(y4);
      yearOnly = year;
      continue;
    }
    const mon = Number(m[4]);
    const sep = m[5];
    const day = m[6] !== undefined ? Number(m[6]) : null;
    if (year === null || mon < 1 || mon > 12) continue;
    // "2.45%" 같은 숫자는 날짜가 아니다
    if (day !== null && (day < 1 || day > 31)) continue;
    // 연도 없이 "3." 처럼 월만 점으로 끝나면 숫자 목록일 수 있어 연도 바로 뒤일 때만 믿는다
    // 단, "2026. 1. ~ 12." 처럼 "~" 바로 뒤면 기간의 끝이다.
    const afterTilde = t.slice(0, m.index).trimEnd().endsWith("~");
    if (day === null && sep !== "월" && yearOnly === null && !afterTilde) continue;
    yearOnly = null;
    let y = year;
    let d = day === null ? lastDay(y, mon) : Math.min(day, lastDay(y, mon));
    let cand = iso(y, mon, d);
    // "2025. 12. 1. ~ 1. 15." 처럼 해를 넘기는 기간
    if (afterTilde && prev && cand < prev) {
      y += 1;
      d = day === null ? lastDay(y, mon) : Math.min(day, lastDay(y, mon));
      cand = iso(y, mon, d);
      year = y;
    }
    take(cand);
  }
  if (yearOnly !== null) take(iso(yearOnly, 12, 31), false);
  return best;
}
