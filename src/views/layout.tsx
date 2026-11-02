import type { Child } from "hono/jsx";
import { CSS } from "./styles.js";
import { CLIENT_JS } from "./client.js";
import { agoTime } from "./format.js";
import type { RunInfo } from "../data.js";

export type Tab = "home" | "hygiene" | "prices" | "about";

export function Layout(props: {
  title: string;
  description?: string;
  tab: Tab;
  runs?: Record<string, { lastOk?: RunInfo; last?: RunInfo }>;
  children: Child;
}) {
  const fullTitle = props.tab === "home" ? "동네살림 · 식당 위생 체크와 장보기 시세" : `${props.title} · 동네살림`;
  const desc =
    props.description ?? "우리 동네 식당의 위생 위반 기록과 이번 주 농축수산물 소매가격을 한곳에서 쉽게 확인하세요.";
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{fullTitle}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={desc} />
        <meta name="theme-color" content="#0d6e63" />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230d6e63'/%3E%3Ctext x='16' y='22' font-size='17' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='700'%3E살%3C/text%3E%3C/svg%3E"
        />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <a class="skip" href="#main">본문으로 건너뛰기</a>
        <header class="top">
          <div class="wrap">
            <a class="brand" href="/" aria-label="동네살림 홈">
              <span class="logo" aria-hidden="true">살</span>
              <span class="name">동네살림</span>
            </a>
            <nav class="tabs" aria-label="주요 메뉴">
              <a href="/hygiene" aria-current={props.tab === "hygiene" ? "page" : undefined}>
                식당 위생
              </a>
              <a href="/prices" aria-current={props.tab === "prices" ? "page" : undefined}>
                장보기 시세
              </a>
            </nav>
          </div>
        </header>
        <main id="main" class="wrap">
          {props.children}
        </main>
        <footer>
          <div class="wrap stack">
            <p>
              자료: 식품의약품안전처 식품안전나라 「행정처분결과(식품접객업)」, 한국농수산식품유통공사(aT) 「일별
              도·소매 가격정보」. 공공데이터를 가공해 보여주며, 원본과 차이가 있을 수 있어요.
            </p>
            {props.runs && (
              <p class="faint">
                {props.runs.hygiene?.lastOk?.finished_at && (
                  <span>위생 정보 갱신 {agoTime(props.runs.hygiene.lastOk.finished_at)} · </span>
                )}
                {props.runs.prices?.lastOk?.finished_at && (
                  <span>가격 정보 갱신 {agoTime(props.runs.prices.lastOk.finished_at)} · </span>
                )}
                <a href="/about">이 서비스에 대해</a>
              </p>
            )}
          </div>
        </footer>
        <script dangerouslySetInnerHTML={{ __html: CLIENT_JS }} />
      </body>
    </html>
  );
}

export function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" stroke-linecap="round" />
    </svg>
  );
}

export function Empty(props: { icon: string; title: string; children?: Child }) {
  return (
    <div class="card empty">
      <div class="big" aria-hidden="true">
        {props.icon}
      </div>
      <h3 style="margin:8px 0 6px">{props.title}</h3>
      <div class="muted small">{props.children}</div>
    </div>
  );
}
