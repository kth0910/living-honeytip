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

## 확인이 필요한 부분

개발 환경에서 원본 API에 접속할 수 없었습니다. 아래는 공개 문서와 공개 코드로 맞춘 부분입니다.

- **aT perDay 응답 필드 이름:** `item_nm`, `vrty_nm`, `grd_nm`, `sgg_nm`, `unit`, `unit_sz`, `exmn_dd_prc` 등으로 맞췄습니다. 요청 파라미터(`cond[exmn_ymd::EQ]`, `cond[se_cd::EQ]=01` 등)는 공개 코드로 확인했습니다. 수집기는 여러 후보 필드명을 차례로 시도하고, 가격 필드는 이름에 `prc`가 들어간 필드로 대체합니다.
- **행정처분 필드 이름:** 배포한 함수에서 실제 I0470 응답으로 확인했습니다 (`PRCSCITYPOINT_BSSHNM`, `INDUTY_CD_NM`, `ADDR`, `DSPS_DCSNDT`, `DSPS_TYPECD_NM`, `DSPSCN`, `VILTCN`, `LAWORD_CD_NM`, `LCNS_NO` 등). `GET /admin/probe/hygiene?svc=…`(관리 토큰 필요)로 다시 볼 수 있습니다.
- **무단멸실:** 폐업 신고 없이 사라진 가게에 대한 `영업소폐쇄`는 위생 위반이 아니므로 가장 낮은 단계로 두고 '폐업 미신고(위생 무관)' 태그를 붙입니다.
- **식품안전나라 날짜 필터(`/DSPS_DCSNDT=YYYYMMDD`):** 동작하지 않으면 수집기가 이를 감지하고 전체 순회만 사용합니다.
