import { defineConfig } from "@neon/config/v1";

// Function secrets are read from the env file passed to `neon deploy --env <file>`.
// Only keys that are actually set are uploaded: an unset key is left out instead of
// being written as "" (which would delete the live value).
const SECRET_KEYS = [
  "FOODSAFTYKOREA_OPEN_API", // 식품안전나라 Open API 인증키 (I0470 행정처분결과)
  "DATAKR_API_KEY", // 공공데이터포털 serviceKey (aT 일별 도·소매 가격정보)
  "KAMIS_CERT_KEY", // (선택) KAMIS 직접 키 — 있으면 평년 가격까지 사용
  "KAMIS_CERT_ID",
  "ADMIN_TOKEN", // 수동 수집 실행용 토큰 (/admin/*)
] as const;

const functionEnv: Record<string, string> = {};
for (const key of SECRET_KEYS) {
  const value = process.env[key];
  if (value) functionEnv[key] = value;
}

export default defineConfig({
  auth: false,
  functions: {
    web: {
      name: "동네살림 web + API",
      source: "./src/index.ts",
      env: functionEnv,
    },
  },
  triggers: {
    // 03:20 KST — 식품안전나라 API는 평일 낮 시간대에 응답 제한이 있어 새벽에 수집
    "hygiene-daily": {
      type: "schedule",
      function: "web",
      cron: "20 18 * * *",
      functionPath: "/cron/hygiene",
    },
    // 03:50 KST, 위생등급 지정 현황 (처분 수집 뒤)
    "grades-daily": {
      type: "schedule",
      function: "web",
      cron: "50 18 * * *",
      functionPath: "/cron/grades",
    },
    // 05:10 KST, 공공서비스(혜택) 목록
    "benefits-daily": {
      type: "schedule",
      function: "web",
      cron: "10 20 * * *",
      functionPath: "/cron/benefits",
    },
    // 매일 14:20 KST, 생필품 가격 (조사는 2주마다라 대부분 확인만 하고 끝남)
    "goods-daily": {
      type: "schedule",
      function: "web",
      cron: "20 5 * * *",
      functionPath: "/cron/goods",
    },
    // 10:40 / 19:40 KST — 가격 조사 결과가 반영된 뒤 수집
    "prices-twice-daily": {
      type: "schedule",
      function: "web",
      cron: "40 1,10 * * *",
      functionPath: "/cron/prices",
    },
  },
  branch: (branch) => {
    if (branch.isDefault) return {};
    if (!branch.exists) return { ttl: "7d" };
    return {};
  },
});
