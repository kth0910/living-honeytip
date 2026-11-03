import type { Child } from "hono/jsx";
import { raw } from "hono/html";
import { ICONS } from "../assets.generated.js";

export type IconName = keyof typeof ICONS & string;

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** assets/icons 의 SVG를 그대로 그린다 (색은 글자색을 따름) */
export function Icon(props: { name: IconName; label?: string; class?: string }) {
  const icon = ICONS[props.name];
  if (!icon) return null;
  const paint = icon.filled
    ? 'fill="currentColor"'
    : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const a11y = props.label ? `role="img" aria-label="${esc(props.label)}"` : 'aria-hidden="true" focusable="false"';
  return raw(
    `<svg class="ico${props.class ? ` ${esc(props.class)}` : ""}" viewBox="0 0 24 24" ${paint} ${a11y}>${icon.body}</svg>`,
  );
}

export type TileColor = "green" | "red" | "orange" | "blue" | "gray";

export function Tile(props: { icon: IconName; color: TileColor }) {
  return (
    <span class={`tile ${props.color}`} aria-hidden="true">
      <Icon name={props.icon} />
    </span>
  );
}

export function Empty(props: { icon: IconName; color?: TileColor; title: string; children?: Child }) {
  return (
    <div class="empty">
      <Tile icon={props.icon} color={props.color ?? "gray"} />
      <h2>{props.title}</h2>
      {props.children}
    </div>
  );
}

export function SectionHead(props: { title: Child; id?: string; more?: { href: string; label: string } }) {
  return (
    <div class="section-head">
      <h2 class="section-title" id={props.id}>
        {props.title}
      </h2>
      {props.more && (
        <a class="more" href={props.more.href}>
          {props.more.label}
          <Icon name="chevron-right" />
        </a>
      )}
    </div>
  );
}

export function Notice(props: { icon?: IconName; tone?: "good" | "warn"; children: Child }) {
  return (
    <div class={`notice ${props.tone ?? ""}`}>
      <Icon name={props.icon ?? "info"} />
      <div>{props.children}</div>
    </div>
  );
}

/** 선택 상자 (오른쪽 화살표 아이콘 포함) */
export function Select(props: { name?: string; id?: string; label: string; autosubmit?: boolean; children: Child }) {
  return (
    <span class="select">
      <select name={props.name} id={props.id} aria-label={props.label} data-autosubmit={props.autosubmit ? "" : undefined}>
        {props.children}
      </select>
      <Icon name="chevron-down" />
    </span>
  );
}
