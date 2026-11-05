import { ADMIN_CLOSURE_SQL_RE } from "./lib/severity.js";

// Schema as code. Append new migrations; never edit an applied one.
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: `
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 식품접객업 행정처분 (식품안전나라 I2630)
CREATE TABLE hygiene_actions (
  id            bigserial PRIMARY KEY,
  source_key    text NOT NULL UNIQUE,          -- 원본 행 해시 (중복 방지)
  biz_key       text NOT NULL,                 -- 업소 단위 묶음 키 (상호+주소)
  biz_name      text NOT NULL,
  biz_type      text,
  addr          text,
  sido          text,
  sigungu       text,
  action_date   date,                          -- 처분확정일자
  action_type   text,                          -- 처분유형
  severity      smallint NOT NULL DEFAULT 1,   -- 3 영업취소/폐쇄, 2 영업정지·과징금, 1 그 밖
  violation     text,                          -- 위반일자 및 위반내용
  action_detail text,                          -- 처분내용/기간
  law           text,
  license_no    text,
  raw           jsonb NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hygiene_actions_biz_key_idx ON hygiene_actions (biz_key);
CREATE INDEX hygiene_actions_region_idx ON hygiene_actions (sido, sigungu, action_date DESC);
CREATE INDEX hygiene_actions_date_idx ON hygiene_actions (action_date DESC);
CREATE INDEX hygiene_actions_name_trgm ON hygiene_actions USING gin (biz_name gin_trgm_ops);
CREATE INDEX hygiene_actions_addr_trgm ON hygiene_actions USING gin (addr gin_trgm_ops);

-- 소매 가격 (일자 · 지역 · 품목/품종/등급/단위)
CREATE TABLE price_daily (
  survey_date    date NOT NULL,
  region_code    text NOT NULL,               -- '0000' = 전국 평균
  region_name    text NOT NULL,
  category_code  text NOT NULL,
  category_name  text NOT NULL,
  item_code      text NOT NULL,
  item_name      text NOT NULL,
  kind_code      text NOT NULL DEFAULT '',
  kind_name      text NOT NULL DEFAULT '',
  rank_code      text NOT NULL DEFAULT '',
  rank_name      text NOT NULL DEFAULT '',
  unit           text NOT NULL DEFAULT '',
  price          numeric NOT NULL,
  -- 제공처가 비교 가격을 함께 주는 경우(KAMIS) 저장. 없으면 이력에서 계산.
  price_1w       numeric,
  price_1m       numeric,
  price_1y       numeric,
  price_normal   numeric,                     -- 평년
  samples        integer NOT NULL DEFAULT 1,  -- 평균에 들어간 조사 지점 수
  source         text NOT NULL,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_date, region_code, item_code, kind_code, rank_code, unit)
);
CREATE INDEX price_daily_lookup_idx ON price_daily (region_code, item_code, kind_code, rank_code, unit, survey_date DESC);
CREATE INDEX price_daily_date_idx ON price_daily (region_code, survey_date DESC);

-- 수집 실행 기록 / 이어받기 상태
CREATE TABLE ingest_runs (
  id          bigserial PRIMARY KEY,
  job         text NOT NULL,
  trigger     text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status      text NOT NULL DEFAULT 'running',  -- running | ok | partial | error
  rows        integer NOT NULL DEFAULT 0,
  message     text
);
CREATE INDEX ingest_runs_job_idx ON ingest_runs (job, started_at DESC);

CREATE TABLE ingest_state (
  job        text PRIMARY KEY,
  state      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`,
  },
  {
    // 폐업 신고 없이 사라진 가게(무단멸실 등)의 영업소폐쇄는 위생 위반이 아니므로 가장 낮은 단계로
    id: "002_admin_closure_severity",
    sql: `
UPDATE hygiene_actions SET severity = 1
 WHERE violation ~ '무단\\s*멸실|폐업|소재\\s*불명|시설\\s*멸실|영업\\s*사실\\s*없음';
`,
  },
  {
    // 이미 문 닫은 가게의 서류 정리(철거·멸실·장기 휴업·폐업) → 0 '폐업 정리'
    id: "003_admin_closure_level0",
    sql: `
UPDATE hygiene_actions SET severity = 0
 WHERE violation ~ '${ADMIN_CLOSURE_SQL_RE}'
   AND (coalesce(action_type, '') || ' ' || coalesce(action_detail, '')) ~ '폐쇄|취소';
UPDATE hygiene_actions SET severity = 1
 WHERE violation ~ '${ADMIN_CLOSURE_SQL_RE}' AND severity > 1;
`,
  },
  {
    // 폐업 정리 판정 확장(사업자등록 말소, 다른 업소 운영 중, 영업소 없음)
    id: "004_admin_closure_more",
    sql: `
UPDATE hygiene_actions SET severity = 0
 WHERE violation ~ '${ADMIN_CLOSURE_SQL_RE}'
   AND (coalesce(action_type, '') || ' ' || coalesce(action_detail, '')) ~ '폐쇄|취소'
   AND severity <> 0;
`,
  },
  {
    // 처분 기간을 문장 대신 날짜로 저장 (화면에서 "11월 1일부터 7일까지"처럼 쓰기 위해)
    id: "005_action_period_dates",
    sql: `
ALTER TABLE hygiene_actions ADD COLUMN period_start date, ADD COLUMN period_end date;
UPDATE hygiene_actions SET
  period_start = CASE WHEN raw->>'DSPS_BGNDT' ~ '^[0-9]{8}$' THEN to_date(raw->>'DSPS_BGNDT', 'YYYYMMDD') END,
  period_end   = CASE WHEN raw->>'DSPS_ENDDT' ~ '^[0-9]{8}$' THEN to_date(raw->>'DSPS_ENDDT', 'YYYYMMDD') END,
  action_detail = nullif(btrim(coalesce(raw->>'DSPSCN', raw->>'DSPS_CN', '')), '');
`,
  },
  {
    // 음식점 위생등급 지정 현황 (식품안전나라 C004). 개인정보(대표자, 전화, 사업자번호)는 저장하지 않는다.
    id: "006_hygiene_grades",
    sql: `
CREATE TABLE hygiene_grades (
  grade_no      text PRIMARY KEY,               -- 위생등급 지정번호
  license_no    text,
  biz_key       text NOT NULL,                  -- hygiene_actions.biz_key 와 같은 규칙
  biz_name      text NOT NULL,
  biz_type      text,
  addr          text,
  sido          text,
  sigungu       text,
  grade         text,                           -- 매우 우수, 우수, 좋음 등 원문
  grade_rank    smallint NOT NULL DEFAULT 0,    -- 3 매우 우수, 2 우수, 1 좋음, 0 그 밖
  assigned_on   date,
  valid_from    date,
  valid_to      date,
  cancelled_on  date,
  biz_status    text,                           -- 정상, 폐업 등
  closed_on     date,
  agency        text,
  raw           jsonb NOT NULL,
  fetched_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hygiene_grades_biz_key_idx ON hygiene_grades (biz_key);
CREATE INDEX hygiene_grades_region_idx ON hygiene_grades (sido, sigungu, grade_rank DESC);
CREATE INDEX hygiene_grades_name_trgm ON hygiene_grades USING gin (biz_name gin_trgm_ops);
CREATE INDEX hygiene_grades_addr_trgm ON hygiene_grades USING gin (addr gin_trgm_ops);
`,
  },
];
