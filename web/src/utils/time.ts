/** Time formatting helpers. Timestamps are unix seconds. */
import { i18next } from "@/i18n";

type FormatOptions = {
  timezone?: string;
  hour12?: boolean;
  seconds?: boolean;
};

function locale() {
  return i18next.language || navigator.language;
}

export function resolveTimezone(configured?: string) {
  return configured || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(options: Intl.DateTimeFormatOptions) {
  const key = `${locale()}|${JSON.stringify(options)}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale(), options);
    formatters.set(key, fmt);
  }
  return fmt;
}

export function formatTime(
  ts: number,
  { timezone, hour12, seconds = true }: FormatOptions = {},
) {
  return formatter({
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
    hour12,
    timeZone: timezone,
  }).format(ts * 1000);
}

export function formatDateTime(
  ts: number,
  { timezone, hour12 }: FormatOptions = {},
) {
  return formatter({
    dateStyle: "short",
    timeStyle: "short",
    hour12,
    timeZone: timezone,
  }).format(ts * 1000);
}

export function formatDay(ts: number, { timezone }: FormatOptions = {}) {
  return formatter({
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(ts * 1000);
}

/** Calendar day key (YYYY-MM-DD) in the given timezone. */
export function dayKey(ts: number, timezone?: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(ts * 1000);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

/** "2 min ago" style label. */
export function formatRelative(ts: number, now = Date.now() / 1000) {
  const delta = Math.round(ts - now);
  const rtf = new Intl.RelativeTimeFormat(locale(), {
    numeric: "auto",
    style: "short",
  });
  for (const [unit, seconds] of relativeUnits) {
    if (Math.abs(delta) >= seconds || unit === "second") {
      return rtf.format(Math.round(delta / seconds), unit);
    }
  }
  return "";
}

export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}
