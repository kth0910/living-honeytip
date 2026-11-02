# 동네살림 — 식당 위생 체크 · 이번 주 장보기 시세

공공데이터 두 가지를 쉽게 읽을 수 있게 보여주는 웹사이트입니다. 메뉴는 두 개입니다.

| 메뉴 | 주소 | 데이터 |
|---|---|---|
| 식당 위생 체크 | `/hygiene`, `/hygiene/b/:업소키` | 식품안전나라 Open API `I0470` 행정처분결과 (`FOODSAFETY_SERVICE`로 `I2630` 식품접객업 전용으로 바꿀 수 있음) |
| 장보기 시세 | `/prices`, `/prices/item?k=…` | 공공데이터포털 「한국농수산식품유통공사_일별 도·소매 가격정보」 (`apis.data.go.kr/B552845/perDay/price`), KAMIS 키가 있으면 KAMIS `dailyPriceByCategoryList` |

## 구성

```
브라우저 ──▶ Neon Function "web" (Hono, 서버 렌더링 HTML) ──▶ Neon Postgres
                    ▲
 Neon Function Trigger (cron) ── POST /cron/hygiene (매일 03:20 KST)
                              └─ POST /cron/prices  (매일 10:40, 19:40 KST)
```

- `neon.ts`: 함수 1개(`web`)와 cron 트리거 2개를 선언합니다. 함수 환경변수에는 설정된 키만 올라갑니다.
- `src/app.tsx`: 페이지와 API 라우트입니다.
- `src/ingest/*`: 수집기입니다. 원본 행을 정규화한 뒤 upsert하고, 실행 기록은 `ingest_runs`에 남깁니다.
- `src/migrations.ts`: 스키마 정의입니다. 처음 요청이 들어올 때 advisory lock을 잡고 한 번만 적용합니다.
- DB 드라이버는 `pg`(node-postgres)를 씁니다. 모듈 범위의 풀(`max: 5`)에 `attachDatabasePool`을 붙였습니다. Neon Functions 권장 방식을 따른 것입니다.

## 환경변수

| 이름 | 필수 | 설명 |
|---|---|---|
| `DATABASE_URL` | ✓ | Neon이 함수에 자동 주입합니다. 로컬에서는 `neon deploy`나 `neon env pull`이 `.env.local`에 써 줍니다. |
| `FOODSAFTYKOREA_OPEN_API` | ✓ | 식품안전나라 인증키 (I0470 활용신청 필요) |
| `DATAKR_API_KEY` | ✓ | 공공데이터포털 serviceKey. Encoding, Decoding 둘 다 됩니다. |
| `KAMIS_CERT_KEY`, `KAMIS_CERT_ID` | | 있으면 KAMIS에서 직접 받아오고 평년 가격까지 보여줍니다. |
| `ADMIN_TOKEN` | | 있으면 `/admin/*` 수동 실행 엔드포인트가 열립니다. |

## 배포 (Neon)

```bash
npm install
npm run build                  # tsc 타입검사 + 함수 번들 확인
neon login                     # 브라우저 로그인 (또는 NEON_API_KEY 환경변수)
neon deploy --env .env.local   # 함수·트리거 배포, DATABASE_URL 등을 .env.local로 가져옴
neon functions get web         # invocation_url 확인
```

`neon init`은 이미 실행해 두었습니다. `.neon` 파일이 `org-rapid-dawn-67726240 / odd-sound-54493512 / production`을 가리킵니다.

배포 직후 첫 수집을 바로 돌리려면 `ADMIN_TOKEN`을 설정한 뒤 아래를 실행합니다. 설정하지 않았다면 트리거가 정해진 시간에 실행될 때까지 기다리면 됩니다.

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$URL/admin/ingest/prices"
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" "$URL/admin/ingest/hygiene?budgetMs=780000"
curl "$URL/healthz"
```

위생 정보는 전국 전체를 1,000건씩 이어받습니다. 끊긴 지점은 `ingest_state`에 저장되므로, 자료가 많으면 며칠에 걸쳐 채워집니다.

## 로컬 실행과 테스트

```bash
npm run db:migrate             # .env.local의 DATABASE_URL(_UNPOOLED)에 스키마 적용
npm run ingest -- prices       # 수집 1회 실행
npm start                      # http://localhost:3000
TEST_DATABASE_URL=postgres://... npm test   # E2E (실제 Postgres + 응답 형식을 흉내 낸 가짜 API 서버)
```

`npm test`는 `TEST_DATABASE_URL` DB의 public 스키마를 지우고 다시 만듭니다. 운영 DB를 넣지 마세요.

## 실제 데이터로 확인한 사항

- **aT 가격 API (`apis.data.go.kr/B552845/perDay/price`)**
  - 부류코드(`ctgry_cd`)와 품목코드(`item_cd`)를 함께 줘야만 결과가 나옵니다. 날짜만으로 조회하면 0건입니다.
  - 그래서 소매(`se_cd=01`) 가격이 있는 86개 품목을 `src/ingest/catalog.ts`에 두고, 품목별로 기간(`GTE`/`LTE`)을 정해 조회합니다.
  - 주말에는 일부 품목만 조사되므로, 대부분의 품목이 조사된 최근 날짜를 기준일로 씁니다.
- **식품안전나라 행정처분**
  - `I2630`(식품접객업)과 `I0470`(식품업 전체)을 함께 받아 중복을 제거합니다. 필드는 같습니다.
  - 날짜 필터(`/DSPS_DCSNDT=`)는 동작하지 않아 전체 목록을 순회합니다(합계 약 8,600건, 1,000건씩 9번 호출).
  - 오늘 자료는 19시 이후에만 받을 수 있습니다.
  - 해외 IP에서도 응답합니다. Neon 싱가포르 리전에서 확인했습니다.
- **폐업 정리:** 처분의 약 88%는 시설 철거·멸실, 장기 휴업, 사업자등록 말소처럼 이미 문 닫은 가게를 서류상 정리한 `영업소폐쇄`입니다.
  - 심각도 0 '폐업 정리(위생 무관)'로 분리합니다(`src/lib/severity.ts`).
  - 동네 둘러보기 목록과 요약에서는 기본으로 빼고, 가게 이름으로 검색할 때는 함께 보여줍니다.
- **공개 범위:** 공개되는 처분은 사실상 영업정지 이상입니다. 과태료는 거의 포함되지 않습니다.

## 이 개발 환경에서 배포할 때

`api.neon.tech`가 막힌 환경에서는 같은 API를 `console.neon.tech` 주소로 쓸 수 있습니다.

```bash
NEON_API_HOST=https://console.neon.tech/api/v2 neon deploy --env .env.local
```
