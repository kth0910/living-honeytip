// TEST-ONLY mock of the two upstream APIs, shaped like their documented responses.
// Every business name and price here is synthetic — never shipped or shown in production.
import { createServer, type Server } from "node:http";

const SIDO = [
  ["서울특별시", ["강남구", "마포구", "송파구", "관악구"]],
  ["경기도", ["성남시 분당구", "수원시 영통구", "고양시 일산동구"]],
  ["부산광역시", ["해운대구", "부산진구"]],
  ["대구광역시", ["수성구"]],
] as const;
const NAMES = ["가나다김밥", "샘플치킨", "예시카페", "테스트분식", "모의국밥", "견본베이커리", "시험족발", "임시호프", "가상떡볶이", "예제초밥"];
const TYPES = ["일반음식점", "휴게음식점", "제과점영업", "일반음식점", "단란주점영업"];
const ACTIONS: [string, string][] = [
  ["영업정지", "영업정지 7일"],
  ["과태료부과", "과태료 30만원"],
  ["시정명령", "시정명령"],
  ["과징금부과", "영업정지 15일에 갈음한 과징금"],
  ["영업소폐쇄", "영업소 폐쇄"],
  ["경고", "경고"],
];
const VIOL = [
  "2026.08.12 유통기한(소비기한)이 경과된 제품을 조리 목적으로 보관",
  "2026.07.03 영업자 및 종업원 건강진단 미실시",
  "2026.06.21 청소년에게 주류 제공",
  "2026.05.30 조리장 위생상태 불량(바닥 및 배수구 청결 불량)",
  "2026.04.18 식품위생교육 미이수",
  "2026.03.09 냉동식품 보관기준 위반",
  "2026.02.11 원산지 표시 위반(돼지고기)",
];

function rnd(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// 위생등급 지정 현황(C004) 가짜 자료. 등급은 실제 공개 자료처럼 모두 '적합'.
function makeGradeRows() {
  const rows: Record<string, string>[] = [];
  const add = (name: string, addr: string, type: string, from: string, to: string, status = "정상", closed = "") =>
    rows.push({
      BSSH_NM: name, ADDR: addr, INDUTY_NM: type, HG_ASGN_LV: "적합", HG_ASGN_YMD: from, ASGN_FROM: from,
      ASGN_TO: to, ASGN_CANCEL_YMD: "", CLSBIZ_DVS_CD_NM: status, CLSBIZ_DT: closed, LCNS_NO: "",
      HG_ASGN_NO: `제HG${String(rows.length + 1).padStart(9, "0")}호`, HG_ASGN_NM: "식품의약품안전처",
      PRSDNT_NM: "홍길동", TELNO: "02-000-0000", WRKR_REG_NO: "1234567890", INSTT_CD_NM: "", CHNG_DT: "",
    });
  add("예시청결식당 본점", "서울특별시 강남구 예시로90길 1", "일반음식점", "20260101", "20271231");
  add("예시청결카페", "서울특별시 마포구 예시로91길 2", "휴게음식점", "20261020", "20281019");
  add("예시청결분식", "부산광역시 해운대구 예시로92길 3", "일반음식점", "20250301", "20270228");
  add("예시만료식당", "서울특별시 강남구 예시로93길 4", "일반음식점", "20230101", "20241231");
  add("예시폐업카페", "서울특별시 강남구 예시로94길 5", "휴게음식점", "20260101", "20271231", "폐업(자진)", "20260901");
  // 처분 기록도 있는 가게(상호와 주소가 같아 한 가게로 묶여야 함)
  add("가나다김밥 역삼본점", "서울특별시 강남구 예시로1길 1", "일반음식점", "20250601", "20270531");
  return rows;
}

function makeHygieneRows() {
  const rows: Record<string, string>[] = [];
  const r = rnd(42);
  for (const [sido, sggs] of SIDO) {
    for (const sgg of sggs) {
      for (let i = 0; i < 6; i++) {
        const name = `${NAMES[Math.floor(r() * NAMES.length)]} ${sgg.split(" ").pop()!.replace(/구|시/, "")}${i + 1}호점`;
        const addr = `${sido} ${sgg} 예시로${Math.floor(r() * 90) + 1}길 ${Math.floor(r() * 50) + 1}`;
        const times = r() < 0.25 ? 2 : 1;
        for (let t = 0; t < times; t++) {
          const [type, detail] = ACTIONS[Math.floor(r() * ACTIONS.length)];
          const daysAgo = Math.floor(r() * 900);
          const d = new Date(Date.UTC(2026, 10, 2) - daysAgo * 86400_000);
          const ymd = d.toISOString().slice(0, 10).replaceAll("-", "");
          rows.push({
            PRCSCITYPOINT_BSSHNM: name,
            INDUTY_CD_NM: TYPES[Math.floor(r() * TYPES.length)],
            LCNS_NO: "",
            ADDR: addr,
            DSPS_DCSNDT: ymd,
            DSPS_TYPECD_NM: type,
            DSPSCN: detail,
            VILTCN: VIOL[Math.floor(r() * VIOL.length)],
            LAWORD_CD_NM: "식품위생법 제44조",
          });
        }
      }
    }
  }
  // 식당이 아닌 식품업소 1건 (범위 필터 테스트)
  rows.push({
    PRCSCITYPOINT_BSSHNM: "예시건강식품판매점",
    INDUTY_CD_NM: "건강기능식품일반판매업",
    LCNS_NO: "",
    ADDR: "서울특별시 강남구 예시로5길 5",
    DSPS_DCSNDT: "20261028",
    DSPS_TYPECD_NM: "과태료부과",
    DSPSCN: "과태료 50만원",
    VILTCN: "(20261001)표시기준 위반",
    LAWORD_CD_NM: "건강기능식품에 관한 법률",
  });
  // 위생과 무관한 행정 정리(무단멸실) 1건
  rows.push({
    PRCSCITYPOINT_BSSHNM: "예시폐업식당",
    INDUTY_CD_NM: "일반음식점",
    LCNS_NO: "",
    ADDR: "서울특별시 마포구 예시로99길 9",
    DSPS_DCSNDT: "20261020",
    DSPS_TYPECD_NM: "영업소폐쇄",
    DSPSCN: "영업소폐쇄",
    VILTCN: "(20260901)무단멸실",
    LAWORD_CD_NM: "식품위생법 제75조(허가취소 등) 3항",
  });
  // 오늘 처분 1건 (최근 필터 테스트)
  rows.push({
    PRCSCITYPOINT_BSSHNM: "가나다김밥 역삼본점",
    INDUTY_CD_NM: "일반음식점",
    LCNS_NO: "",
    ADDR: "서울특별시 강남구 예시로1길 1",
    DSPS_DCSNDT: "20261102",
    DSPS_TYPECD_NM: "영업정지",
    DSPSCN: "영업정지·5일",
    VILTCN: "2026.10.20 조리장 내 이물(쥐 배설물) 발견 — 1차",
    LAWORD_CD_NM: "식품위생법 제7조",
  });
  return rows;
}

const ITEMS: { c: string; cn: string; i: string; n: string; v: string; vn: string; unit: string; sz: string; base: number }[] = [
  { c: "200", cn: "채소류", i: "211", n: "배추", v: "03", vn: "가을", unit: "포기", sz: "1", base: 4200 },
  { c: "200", cn: "채소류", i: "231", n: "무", v: "01", vn: "가을", unit: "개", sz: "1", base: 2300 },
  { c: "200", cn: "채소류", i: "245", n: "양파", v: "00", vn: "양파", unit: "kg", sz: "1", base: 2600 },
  { c: "200", cn: "채소류", i: "246", n: "파", v: "00", vn: "대파", unit: "kg", sz: "1", base: 3100 },
  { c: "200", cn: "채소류", i: "225", n: "토마토", v: "00", vn: "토마토", unit: "kg", sz: "1", base: 6900 },
  { c: "200", cn: "채소류", i: "214", n: "상추", v: "02", vn: "청", unit: "g", sz: "100", base: 1200 },
  { c: "400", cn: "과일류", i: "411", n: "사과", v: "05", vn: "후지", unit: "개", sz: "10", base: 27000 },
  { c: "400", cn: "과일류", i: "412", n: "배", v: "01", vn: "신고", unit: "개", sz: "10", base: 39000 },
  { c: "400", cn: "과일류", i: "415", n: "감귤", v: "02", vn: "노지", unit: "kg", sz: "1", base: 5200 },
  { c: "500", cn: "축산물", i: "4304", n: "돼지", v: "27", vn: "삼겹살", unit: "g", sz: "100", base: 2700 },
  { c: "500", cn: "축산물", i: "9903", n: "계란", v: "23", vn: "XL30구", unit: "구", sz: "30", base: 7100 },
  { c: "500", cn: "축산물", i: "9901", n: "닭", v: "00", vn: "육계", unit: "kg", sz: "1", base: 6200 },
  { c: "600", cn: "수산물", i: "611", n: "고등어", v: "03", vn: "국산(염장)", unit: "손", sz: "1", base: 4100 },
  { c: "600", cn: "수산물", i: "619", n: "물오징어", v: "01", vn: "냉동", unit: "마리", sz: "1", base: 5300 },
  { c: "100", cn: "식량작물", i: "111", n: "쌀", v: "05", vn: "20kg(햅쌀)", unit: "kg", sz: "20", base: 61000 },
  { c: "300", cn: "특용작물", i: "317", n: "새송이버섯", v: "00", vn: "새송이버섯", unit: "g", sz: "100", base: 900 },
];
const SGG = [
  ["1101", "서울"],
  ["2100", "부산"],
  ["2200", "대구"],
  ["2401", "광주"],
  ["2501", "대전"],
];

function priceRows(ymd: string) {
  const d = new Date(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00Z`);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return [];
  const t = (d.getTime() - Date.UTC(2026, 10, 2)) / 86400_000; // 0 = 기준일, 음수 = 과거
  const rows: Record<string, string>[] = [];
  ITEMS.forEach((it, idx) => {
    const trend = 1 + Math.sin((t + idx * 9) / 11) * 0.12 + (idx % 3 === 0 ? -t / 400 : t / 600);
    for (const [grd, gname, gmul] of [["04", "상품", 1], ["05", "중품", 0.86]] as const) {
      SGG.forEach(([sc, sn], si) => {
        const p = Math.round((it.base * trend * gmul * (0.94 + si * 0.03)) / 10) * 10;
        rows.push({
          exmn_ymd: ymd, se_cd: "01", se_nm: "소매", ctgry_cd: it.c, ctgry_nm: it.cn, item_cd: it.i, item_nm: it.n,
          vrty_cd: it.v, vrty_nm: it.vn, grd_cd: grd, grd_nm: gname, sgg_cd: sc, sgg_nm: sn, unit: it.unit,
          unit_sz: it.sz, mrkt_cd: `${sc}01`, mrkt_nm: `${sn}시장`, exmn_dd_prc: String(p),
          exmn_dd_cnvs_prc: String(p), orgnl_reg_dt: `${ymd}150000`,
        });
      });
    }
  });
  return rows;
}

// 공공서비스(혜택) 가짜 자료 (odcloud gov24 형식)
function makeBenefits() {
  const mk = (id: string, name: string, field: string, agency: string, agencyType: string, views: number, reg: string, extra: Record<string, unknown> = {}) => ({
    서비스ID: id, 서비스명: name, 서비스목적요약: `${name} 요약`, 서비스분야: field, 사용자구분: "개인", 지원유형: "현금",
    소관기관명: agency, 소관기관유형: agencyType, 부서명: "담당과", 지원대상: "○ 대상자\r\n- 소득 기준을 충족하는 사람\r\nㆍ 거주 요건 충족", 선정기준: "○ 기준 1\r\n○ 기준 2",
    지원내용: "○ 월 최대 20만 원 지원", 신청방법: "온라인신청", 신청기한: "상시신청", 접수기관: agency, 전화문의: "120",
    상세조회URL: `https://plus.gov.kr/portal/benefitV2/benefitSrvcDtl?svcId=${id}`, 조회수: views, 등록일시: reg, 수정일시: reg, ...extra,
  });
  const list = [
    mk("100000000001", "청년월세 특별지원", "주거·자립", "국토교통부", "중앙행정기관", 90000, "20260101000000"),
    mk("100000000002", "근로·자녀장려금", "생활안정", "국세청", "중앙행정기관", 200000, "20201217142613"),
    mk("200000000001", "강남구 출산축하금", "임신·출산", "서울특별시 강남구", "시군구", 5000, "20261020000000"),
    mk("200000000002", "마포구 어르신 교통비", "보호·돌봄", "서울특별시 마포구", "시군구", 3000, "20261001000000"),
    mk("300000000001", "서울시 청년수당", "고용·창업", "서울특별시", "광역시도", 40000, "20250101000000"),
  ];
  const cond: Record<string, unknown>[] = [
    { 서비스ID: "100000000001", JA0110: 19, JA0111: 34 },
    { 서비스ID: "100000000002", JA0110: 18, JA0111: 65 },
    { 서비스ID: "200000000001", JA0110: 0, JA0111: 150 },
    { 서비스ID: "200000000002", JA0110: 65, JA0111: 150 },
    { 서비스ID: "300000000001", JA0110: 19, JA0111: 34 },
  ];
  return { list, cond };
}

// 생필품(참가격) 가짜 자료 (XML)
function goodsXml(path: string, sp: URLSearchParams): string {
  const wrap = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?><response><result>${inner}</result></response>`;
  const vo = (tag: string, o: Record<string, string>) => `<${tag}>${Object.entries(o).map(([k, v]) => `<${k}>${v}</${k}>`).join("")}</${tag}>`;
  if (path.endsWith("getStandardInfoSvc.do")) {
    const cc = sp.get("classCode");
    const T = "iros.openapi.service.vo.stdInfoVO";
    if (cc === "AL") return wrap([
      vo(T, { code: "030200000", codeName: "가공식품" }), vo(T, { code: "030201000", codeName: "면류", highCode: "030200000" }),
      vo(T, { code: "030201001", codeName: "라면", highCode: "030201000" }), vo(T, { code: "030202000", codeName: "유제품", highCode: "030200000" }),
      vo(T, { code: "030202001", codeName: "우유", highCode: "030202000" }),
    ].join(""));
    if (cc === "UT") return wrap([vo(T, { code: "G", codeName: "g" }), vo(T, { code: "ML", codeName: "ml" }), vo(T, { code: "EA", codeName: "개" })].join(""));
    if (cc === "AR") return wrap(vo(T, { code: "020100000", codeName: "서울특별시" }));
    return wrap("");
  }
  if (path.endsWith("getProductInfoSvc.do")) return wrap([
    vo("item", { goodId: "224", goodName: "예시 흰우유(1L)", goodSmlclsCode: "030202001", goodTotalCnt: "1000", goodTotalDivCode: "ML" }),
    vo("item", { goodId: "553", goodName: "예시 라면(5개입)", goodSmlclsCode: "030201001", goodTotalCnt: "5", goodTotalDivCode: "EA", detailMean: "120g*5개" }),
  ].join(""));
  if (path.endsWith("getStoreInfoSvc.do")) {
    const S = "iros.openapi.service.vo.entpInfoVO";
    return wrap([
      vo(S, { entpId: "1", entpName: "예시마트 강남점", entpTypeCode: "LM", entpAreaCode: "020100000", roadAddrBasic: "서울특별시 강남구 예시로 1" }),
      vo(S, { entpId: "2", entpName: "예시슈퍼 마포점", entpTypeCode: "SM", entpAreaCode: "020100000", roadAddrBasic: "서울특별시 마포구 예시로 2" }),
      vo(S, { entpId: "3", entpName: "예시백화점 부산점", entpTypeCode: "DP", entpAreaCode: "020100000", roadAddrBasic: "부산광역시 해운대구 예시로 3" }),
    ].join(""));
  }
  if (path.endsWith("getProductPriceInfoSvc")) {
    const day = sp.get("goodInspectDay")!, good = sp.get("goodId");
    if (!good) return `<?xml version="1.0"?><response><resultCode>05</resultCode><resultMsg>entpId goodId 에 값이 모두 없습니다.</resultMsg></response>`;
    const surveys: Record<string, number> = { "20261023": 1, "20261009": 0.95 };
    const f = surveys[day];
    if (!f) return wrap("");
    const basePrice = good === "224" ? 3000 : 4500;
    const P = "iros.openapi.service.vo.goodPriceVO";
    return wrap([
      vo(P, { goodInspectDay: day, entpId: "1", goodId: good, goodPrice: String(Math.round(basePrice * f * 0.9)), goodDcYn: "Y", plusoneYn: "N" }),
      vo(P, { goodInspectDay: day, entpId: "2", goodId: good, goodPrice: String(Math.round(basePrice * f)), goodDcYn: "N", plusoneYn: good === "553" ? "Y" : "N" }),
      vo(P, { goodInspectDay: day, entpId: "3", goodId: good, goodPrice: String(Math.round(basePrice * f * 1.3)), goodDcYn: "N", plusoneYn: "N" }),
    ].join(""));
  }
  return wrap("");
}

export function startMock(port: number): Promise<Server> {
  const hygiene = makeHygieneRows();
  const grades = makeGradeRows();
  const calls: string[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);
    calls.push(url.pathname + url.search);
    res.setHeader("content-type", "application/json; charset=utf-8");
    // 식품안전나라: /api/{key}/I2630/json/{start}/{end}[/FILTER=V]
    const m = url.pathname.match(/^\/api\/([^/]+)\/(I0470|I2630|C004)\/json\/(\d+)\/(\d+)(?:\/(.*))?$/);
    if (m) {
      const svc = m[2];
      if (m[1] !== "test-food-key") return res.end(JSON.stringify({ [svc]: { RESULT: { CODE: "INFO-100", MSG: "인증키가 유효하지 않습니다." } } }));
      if (svc === "I2630") return res.end(JSON.stringify({ [svc]: { RESULT: { CODE: "INFO-110", MSG: "활용신청 내역이 없습니다." } } }));
      let rows = svc === "C004" ? grades : hygiene;
      if (m[5]) {
        const [k, v] = decodeURIComponent(m[5]).split("=");
        rows = rows.filter((r) => r[k] === v);
      }
      const s = Number(m[3]), e = Number(m[4]);
      const page = rows.slice(s - 1, e);
      if (!page.length) return res.end(JSON.stringify({ [svc]: { total_count: String(rows.length), RESULT: { CODE: "INFO-200", MSG: "해당하는 데이터가 없습니다." } } }));
      return res.end(JSON.stringify({ [svc]: { total_count: String(rows.length), row: page, RESULT: { CODE: "INFO-000", MSG: "정상처리되었습니다." } } }));
    }
    // data.go.kr perDay — 실제 API처럼 부류코드+품목코드가 없으면 0건, 기간(GTE/LTE) 조건 지원
    if (url.pathname === "/B552845/perDay/price") {
      if (url.searchParams.get("serviceKey") !== "test-datago-key") {
        res.setHeader("content-type", "application/xml");
        return res.end("<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>");
      }
      const sp = url.searchParams;
      const cat = sp.get("cond[ctgry_cd::EQ]"), item = sp.get("cond[item_cd::EQ]");
      let all: Record<string, string>[] = [];
      if (cat && item) {
        const eq = sp.get("cond[exmn_ymd::EQ]");
        const from = eq ?? sp.get("cond[exmn_ymd::GTE]") ?? "20250101";
        const to = eq ?? sp.get("cond[exmn_ymd::LTE]") ?? "20261231";
        for (let d = new Date(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6, 8)}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
          const ymd = d.toISOString().slice(0, 10).replaceAll("-", "");
          if (ymd > to) break;
          all.push(...priceRows(ymd).filter((r) => r.ctgry_cd === cat && r.item_cd === item));
        }
        const se = sp.get("cond[se_cd::EQ]");
        if (se) all = all.filter((r) => r.se_cd === se);
      }
      const pageNo = Number(sp.get("pageNo") || 1);
      const num = Number(sp.get("numOfRows") || 10);
      const items = all.slice((pageNo - 1) * num, pageNo * num);
      return res.end(JSON.stringify({
        response: {
          header: { resultCode: "0", resultMsg: "정상" },
          body: { dataType: "JSON", items: { item: items }, numOfRows: num, pageNo, totalCount: all.length },
        },
      }));
    }
    // 공공서비스(혜택)
    const bm = url.pathname.match(/^\/api\/gov24\/v3\/(serviceList|supportConditions)$/);
    if (bm) {
      if (url.searchParams.get("serviceKey") !== "test-datago-key") { res.statusCode = 401; return res.end("{}"); }
      const { list, cond } = makeBenefits();
      const data = bm[1] === "serviceList" ? list : cond;
      const page = Number(url.searchParams.get("page") || 1), per = Number(url.searchParams.get("perPage") || 10);
      return res.end(JSON.stringify({ currentCount: data.length, data: data.slice((page - 1) * per, page * per), matchCount: data.length, page, perPage: per, totalCount: data.length }));
    }
    // 생필품(참가격)
    if (url.pathname.startsWith("/B551919/ProductPriceInfoService/")) {
      res.setHeader("content-type", "application/xml; charset=utf-8");
      return res.end(goodsXml(url.pathname, url.searchParams));
    }
    res.statusCode = 404;
    res.end("{}");
  });
  (server as any).calls = calls;
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
