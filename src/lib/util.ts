import { createHash } from "node:crypto";

export function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

/** Case/space-insensitive key lookup over an API row. */
export function pick(row: Record<string, unknown>, keys: string[]): string | undefined {
  const norm: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) norm[k.toLowerCase().replace(/[^a-z0-9]/g, "")] = v;
  for (const key of keys) {
    const v = norm[key.toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
  }
  return undefined;
}

/** "1,234" | "1234원" | "-" -> number | null */
export function parsePrice(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const s = String(v).replace(/[,원\s]/g, "");
  if (!s || s === "-" || s === "0") return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 20240105 | 2024-01-05 | 2024.01.05 -> 2024-01-05 */
export function parseDate(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const digits = String(v).replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const y = digits.slice(0, 4), m = digits.slice(4, 6), d = digits.slice(6, 8);
  if (+m < 1 || +m > 12 || +d < 1 || +d > 31) return null;
  return `${y}-${m}-${d}`;
}

/** Today's date in Korea (YYYY-MM-DD). */
export function todayKST(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function compact(iso: string): string {
  return iso.replaceAll("-", "");
}

export async function fetchWithTimeout(url: string, ms = 30_000, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Redacts API keys from URLs/messages before logging or storing them. */
export function redact(text: string): string {
  let out = text;
  for (const key of ["FOODSAFTYKOREA_OPEN_API", "DATAKR_API_KEY", "KAMIS_CERT_KEY", "ADMIN_TOKEN"]) {
    const v = process.env[key];
    if (v && v.length > 4) {
      out = out.split(v).join("***");
      out = out.split(encodeURIComponent(v)).join("***");
    }
  }
  return out;
}
