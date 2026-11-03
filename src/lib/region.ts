// 주소 문자열에서 시도와 시군구를 뽑아 표준 이름으로 맞춘다.

const SIDO: [RegExp, string][] = [
  [/^서울/, "서울"],
  [/^부산/, "부산"],
  [/^대구/, "대구"],
  [/^인천/, "인천"],
  [/^광주/, "광주"],
  [/^대전/, "대전"],
  [/^울산/, "울산"],
  [/^세종/, "세종"],
  [/^경기/, "경기"],
  [/^강원/, "강원"],
  [/^충청북|^충북/, "충북"],
  [/^충청남|^충남/, "충남"],
  [/^전라북|^전북/, "전북"],
  [/^전라남|^전남/, "전남"],
  [/^경상북|^경북/, "경북"],
  [/^경상남|^경남/, "경남"],
  [/^제주/, "제주"],
];

export const SIDO_ORDER = SIDO.map(([, n]) => n);

export function normalizeSido(token: string | undefined): string | null {
  if (!token) return null;
  for (const [re, name] of SIDO) if (re.test(token)) return name;
  return null;
}

export function parseRegion(addr: string | undefined | null): { sido: string | null; sigungu: string | null } {
  if (!addr) return { sido: null, sigungu: null };
  const tokens = addr.replace(/\(.*?\)/g, " ").trim().split(/\s+/);
  const sido = normalizeSido(tokens[0]);
  if (!sido) return { sido: null, sigungu: null };
  if (sido === "세종") return { sido, sigungu: "세종시" };
  const t1 = tokens[1];
  if (!t1 || !/(시|군|구)$/.test(t1)) return { sido, sigungu: null };
  const t2 = tokens[2];
  // 일반구가 있는 시: "성남시 분당구" 에서 "성남시 분당구"
  if (/시$/.test(t1) && t2 && /구$/.test(t2)) return { sido, sigungu: `${t1} ${t2}` };
  return { sido, sigungu: t1 };
}

/** "서울 강남구" 같은 사용자 입력/쿠키 값을 분해 */
export function splitRegionParam(v: string | undefined | null): { sido: string | null; sigungu: string | null } {
  if (!v) return { sido: null, sigungu: null };
  const [first, ...rest] = v.trim().split(/\s+/);
  const sido = normalizeSido(first);
  if (!sido) return { sido: null, sigungu: null };
  return { sido, sigungu: rest.length ? rest.join(" ") : null };
}
