// 처분유형 → 심각도 (3: 문 닫게 하는 처분, 2: 영업정지·과징금, 1: 그 밖의 처분)
export function severityOf(actionType: string | undefined, detail?: string): 1 | 2 | 3 {
  const t = `${actionType ?? ""} ${detail ?? ""}`;
  if (/영업소\s*폐쇄|허가\s*취소|등록\s*취소|영업\s*취소|폐쇄/.test(t)) return 3;
  if (/영업\s*정지|과징금|품목\s*제조\s*정지|정지/.test(t)) return 2;
  return 1;
}

export const SEVERITY_LABEL: Record<number, string> = {
  3: "영업취소·폐쇄",
  2: "영업정지·과징금",
  1: "과태료·시정명령 등",
};

export const SEVERITY_HINT: Record<number, string> = {
  3: "가장 무거운 처분이에요. 가게 문을 닫게 하는 처분입니다.",
  2: "일정 기간 영업을 못 하게 하거나, 그 대신 과징금을 낸 처분이에요.",
  1: "과태료, 시정명령, 경고처럼 비교적 가벼운 처분이에요.",
};

/** 위반내용에서 사람이 이해하기 쉬운 키워드 태그를 뽑는다 */
const TAGS: [RegExp, string][] = [
  [/유통기한|소비기한/, "유통·소비기한 경과"],
  [/이물/, "이물 혼입"],
  [/청소년.*주류|주류.*청소년|미성년/, "청소년 주류 제공"],
  [/건강진단/, "건강진단 미실시"],
  [/위생교육/, "위생교육 미이수"],
  [/원산지/, "원산지 표시 위반"],
  [/영업신고|무신고|미신고/, "신고 관련 위반"],
  [/시설기준|시설\s*개수|무단\s*확장|변경신고/, "시설·변경신고 위반"],
  [/냉장|냉동|보관기준|보존/, "보관 기준 위반"],
  [/조리장|청결|위생적|위생관리|쥐|바퀴/, "위생 상태 불량"],
  [/접객|유흥|도우미/, "접객 행위"],
  [/표시기준|표시\s*위반|표시사항/, "표시 기준 위반"],
  [/식중독/, "식중독"],
];

export function violationTags(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const [re, tag] of TAGS) if (re.test(text) && !out.includes(tag)) out.push(tag);
  return out.slice(0, 3);
}
