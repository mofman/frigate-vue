/** Pure helpers that turn stats snapshots into chart series and labels. */
import type { FrigateStats, Threshold } from "@/types/stats";

/** One chart line: a value per history entry, null where it was missing. */
export type Series = {
  key: string;
  name: string;
  values: (number | null)[];
};

/** Reads numbers that the backend sends as strings, eg "12.5" or "12.5%". */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Builds one series per key found in any snapshot. `pick` returns the keyed
 * group (eg `stats.detectors`) and `read` the value inside each entry.
 * Series without a single value are dropped.
 */
export function collectSeries<T>(
  history: FrigateStats[],
  pick: (stats: FrigateStats) => Record<string, T> | undefined,
  read: (entry: T, key: string) => unknown,
  name: (key: string) => string = (key) => key,
): Series[] {
  const series = new Map<string, Series>();
  history.forEach((stats, index) => {
    for (const [key, entry] of Object.entries(pick(stats) ?? {})) {
      let line = series.get(key);
      if (!line) {
        line = {
          key,
          name: name(key),
          values: Array(history.length).fill(null),
        };
        series.set(key, line);
      }
      line.values[index] =
        entry === undefined ? null : toNumber(read(entry, key));
    }
  });
  return [...series.values()].filter((line) =>
    line.values.some((value) => value !== null),
  );
}

/** Series read straight off each snapshot, eg the overall camera fps. */
export function valueSeries(
  history: FrigateStats[],
  key: string,
  name: string,
  read: (stats: FrigateStats) => unknown,
): Series {
  return { key, name, values: history.map((stats) => toNumber(read(stats))) };
}

export function lastValue(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] !== null) return values[i];
  }
  return null;
}

export type Level = "ok" | "warning" | "error";

export function thresholdLevel(
  value: number | null,
  threshold: Threshold,
): Level {
  if (value === null) return "ok";
  if (value >= threshold.error) return "error";
  if (value >= threshold.warning) return "warning";
  return "ok";
}

/**
 * Appends a live snapshot to a fixed size window. Older or repeated
 * snapshots are ignored so a reconnecting socket can't duplicate points.
 */
export function appendSnapshot(
  history: FrigateStats[],
  next: FrigateStats,
): FrigateStats[] {
  const last = history.at(-1);
  if (!last || next.service.last_updated <= last.service.last_updated) {
    return history;
  }
  return [...history.slice(1), next];
}

/** Rounded upper bound for a chart axis, at least `floor`. */
export function niceMax(values: number[], floor = 0): number {
  const max = Math.max(floor, ...values.filter(Number.isFinite));
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const steps = [1, 2, 2.5, 5, 10];
  const step = steps.find((s) => s * magnitude >= max) ?? 10;
  return step * magnitude;
}

/** Sizes from the storage API, which reports MiB. */
export function formatMiB(mib: number | null | undefined): string {
  if (mib === null || mib === undefined || Number.isNaN(mib) || mib < 0) {
    return "-";
  }
  if (mib < 1024) return `${mib.toFixed(2)} MiB`;
  if (mib < 1048576) return `${(mib / 1024).toFixed(2)} GiB`;
  return `${(mib / 1048576).toFixed(2)} TiB`;
}

/** Trims chart values: integers stay whole, others keep one decimal. */
export function formatValue(value: number | null, unit = ""): string {
  if (value === null) return "-";
  const rounded = Number.isInteger(value) ? value : Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}

/**
 * SVG path for a line in a 100 by 100 viewBox. Missing values break the
 * line rather than dropping it to zero.
 */
export function linePath(values: (number | null)[], max: number): string {
  const count = values.length;
  if (count === 0 || max <= 0) return "";
  const step = count > 1 ? 100 / (count - 1) : 0;
  let path = "";
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const x = (index * step).toFixed(2);
    const y = (100 - (Math.min(value, max) / max) * 100).toFixed(2);
    path += `${drawing ? "L" : "M"}${x} ${y}`;
    drawing = true;
  });
  return path;
}

/** Index of the point under a pointer at `fraction` (0 to 1) of the width. */
export function pointIndex(fraction: number, count: number, bars = false) {
  if (count <= 0) return -1;
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const index = bars
    ? Math.floor(clamped * count)
    : Math.round(clamped * (count - 1));
  return Math.min(index, count - 1);
}
