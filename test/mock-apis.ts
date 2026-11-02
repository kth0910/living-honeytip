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
  // 오늘 처분 1건 (최근 필터 테스트)
  rows.push({
    PRCSCITYPOINT_BSSHNM: "가나다김밥 역삼본점",
    INDUTY_CD_NM: "일반음식점",
    LCNS_NO: "",
    ADDR: "서울특별시 강남구 예시로1길 1",
    DSPS_DCSNDT: "20261102",
    DSPS_TYPECD_NM: "영업정지",
    DSPSCN: "영업정지 5일",
    VILTCN: "2026.10.20 조리장 내 이물(쥐 배설물) 발견",
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

export function startMock(port: number): Promise<Server> {
  const hygiene = makeHygieneRows();
  const calls: string[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost:${port}`);
    calls.push(url.pathname + url.search);
    res.setHeader("content-type", "application/json; charset=utf-8");
    // 식품안전나라: /api/{key}/I2630/json/{start}/{end}[/FILTER=V]
    const m = url.pathname.match(/^\/api\/([^/]+)\/I2630\/json\/(\d+)\/(\d+)(?:\/(.*))?$/);
    if (m) {
      if (m[1] !== "test-food-key") return res.end(JSON.stringify({ I2630: { RESULT: { CODE: "INFO-100", MSG: "인증키가 유효하지 않습니다." } } }));
      let rows = hygiene;
      if (m[4]) {
        const [k, v] = decodeURIComponent(m[4]).split("=");
        rows = rows.filter((r) => r[k] === v);
      }
      const s = Number(m[2]), e = Number(m[3]);
      const page = rows.slice(s - 1, e);
      if (!page.length) return res.end(JSON.stringify({ I2630: { total_count: String(rows.length), RESULT: { CODE: "INFO-200", MSG: "해당하는 데이터가 없습니다." } } }));
      return res.end(JSON.stringify({ I2630: { total_count: String(rows.length), row: page, RESULT: { CODE: "INFO-000", MSG: "정상처리되었습니다." } } }));
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
    res.statusCode = 404;
    res.end("{}");
  });
  (server as any).calls = calls;
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
