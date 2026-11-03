import type { Child } from "hono/jsx";
import { DESIGN_SYSTEM_CSS } from "../assets.generated.js";
import { CLIENT_JS } from "./client.js";
import { agoTime } from "./format.js";
import { Icon, type IconName } from "./ui.js";
import type { RunInfo } from "../data.js";

export { Empty } from "./ui.js";

export type Tab = "home" | "hygiene" | "prices" | "about";

const TABS: { tab: Tab; href: string; label: string; icon: IconName }[] = [
  { tab: "home", href: "/", label: "홈", icon: "home" },
  { tab: "hygiene", href: "/hygiene", label: "식당 위생", icon: "bowl" },
  { tab: "prices", href: "/prices", label: "장보기 시세", icon: "basket" },
];

// Pretendard (SIL OFL) 웹폰트. 실패해도 시스템 글꼴로 보인다.
const FONT_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export function Layout(props: {
  title: string;
  description?: string;
  tab: Tab;
  runs?: Record<string, { lastOk?: RunInfo; last?: RunInfo }>;
  children: Child;
}) {
  const fullTitle = props.tab === "home" ? "동네살림" : `${props.title} | 동네살림`;
  const desc =
    props.description ?? "우리 동네 식당의 위생 위반 기록과 이번 주 장보기 물가를 한곳에서 쉽게 확인하세요.";
  return (
    <html lang="ko">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{fullTitle}</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={desc} />
        <meta name="theme-color" content="#f2f4f6" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#101214" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin="" />
        <link rel="stylesheet" href={FONT_CSS} />
        <style dangerouslySetInnerHTML={{ __html: DESIGN_SYSTEM_CSS }} />
      </head>
      <body>
        <a class="skip" href="#main">
          본문으로 건너뛰기
        </a>
        <header class="appbar">
          <div class="wrap">
            <a class="brand" href="/" aria-label="동네살림 홈">
              <img src="/assets/logo-mark.svg" alt="" width="28" height="28" />
              <span>동네살림</span>
            </a>
            <nav class="topnav" aria-label="주요 메뉴">
              {TABS.map((t) => (
                <a href={t.href} aria-current={props.tab === t.tab ? "page" : undefined}>
                  {t.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main id="main" class="wrap">
          {props.children}
        </main>
        <footer>
          <div class="wrap stack">
            <p>
              식품의약품안전처 식품안전나라의 행정처분 결과와 한국농수산식품유통공사(aT)의 일별 도소매 가격정보를
              쉽게 볼 수 있게 정리했어요. 원본과 차이가 있을 수 있어요.
            </p>
            <p>
              {props.runs?.hygiene?.lastOk?.finished_at && (
                <>위생 정보는 {agoTime(props.runs.hygiene.lastOk.finished_at)}, </>
              )}
              {props.runs?.prices?.lastOk?.finished_at && (
                <>가격 정보는 {agoTime(props.runs.prices.lastOk.finished_at)} 새로 받았어요. </>
              )}
              <a href="/about">서비스 안내</a>
            </p>
          </div>
        </footer>
        <nav class="tabbar" aria-label="하단 메뉴">
          <ul>
            {TABS.map((t) => (
              <li>
                <a href={t.href} aria-current={props.tab === t.tab ? "page" : undefined}>
                  <Icon name={t.icon} />
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <script dangerouslySetInnerHTML={{ __html: CLIENT_JS }} />
      </body>
    </html>
  );
}
