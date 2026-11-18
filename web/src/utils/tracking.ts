/** Pure calculations behind the Tracking Details timeline and overlay. */
import type { FrigateConfig } from "@/types/frigate";
import type {
  LifecycleClass,
  TimelineEntry,
  TrackedEvent,
} from "@/types/event";

export const ANNOTATION_OFFSET_MIN = -10000;
export const ANNOTATION_OFFSET_MAX = 10000;
export const ANNOTATION_OFFSET_STEP = 50;

/** how near the playhead a step must be to count as the current one */
export const ACTIVE_WINDOW = 0.5;
/** how near the playhead a box must be to be drawn on the frame */
export const BOX_WINDOW = 0.05;
const TOLERANCE = 0.01;

export type PathPoint = {
  x: number;
  y: number;
  timestamp: number;
  classType?: LifecycleClass;
};

type Box = [number, number, number, number];

/** Detect stream time for a recording time. */
export function detectTime(recordTime: number, offsetMs: number) {
  return recordTime - offsetMs / 1000;
}

/** Recording time for a detect stream time. */
export function recordTime(detect: number, offsetMs: number) {
  return detect + offsetMs / 1000;
}

export function clampOffset(value: number) {
  return Math.max(
    ANNOTATION_OFFSET_MIN,
    Math.min(ANNOTATION_OFFSET_MAX, value),
  );
}

/** Every known position of an object in time order. */
export function pathPoints(
  event: Pick<TrackedEvent, "data"> | undefined,
  timeline: readonly TimelineEntry[],
): PathPoint[] {
  const saved: PathPoint[] = (event?.data.path_data ?? []).map(
    ([[x, y], timestamp]) => ({ x, y, timestamp }),
  );
  const steps: PathPoint[] = timeline.flatMap((entry) => {
    const box = entry.data.box;
    if (!box) return [];
    // the bottom center of the box, where the object meets the ground
    return [
      {
        x: box[0] + box[2] / 2,
        y: box[1] + box[3],
        timestamp: entry.timestamp,
        classType: entry.class_type,
      },
    ];
  });
  return [...saved, ...steps].sort((a, b) => a.timestamp - b.timestamp);
}

/** Points reached by this detect time, none before the object appears. */
export function visiblePath(
  points: readonly PathPoint[],
  detect: number,
  startTime: number,
) {
  if (detect < startTime - TOLERANCE) return [];
  return points.filter((point) => point.timestamp <= detect + TOLERANCE);
}

/** The timeline step with a box closest to this time, if close enough. */
export function nearestBoxEntry(
  timeline: readonly TimelineEntry[],
  detect: number,
  window = BOX_WINDOW,
) {
  let best: TimelineEntry | undefined;
  let bestDistance = window;
  for (const entry of timeline) {
    if (!entry.data.box) continue;
    const distance = Math.abs(entry.timestamp - detect);
    if (distance <= bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }
  return best;
}

/** Zones of the latest step at or before this time. */
export function zonesAt(timeline: readonly TimelineEntry[], detect: number) {
  let latest: TimelineEntry | undefined;
  for (const entry of timeline) {
    if (
      entry.timestamp <= detect + TOLERANCE &&
      (!latest || entry.timestamp >= latest.timestamp)
    )
      latest = entry;
  }
  return latest?.data.zones ?? [];
}

/**
 * How far along the line below each row the playhead is, from 0 to 1. Each
 * row draws its own piece of the line, so uneven row heights stay accurate.
 */
export function rowProgress(timestamps: readonly number[], detect: number) {
  return timestamps.map((start, index) => {
    const end = timestamps[index + 1];
    if (end === undefined) return 0;
    if (detect <= start) return 0;
    if (detect >= end) return 1;
    return end > start ? (detect - start) / (end - start) : 1;
  });
}

function boxArea(box: Box | undefined, width: number, height: number) {
  if (!box) return undefined;
  const fraction = box[2] * box[3];
  return {
    pixels: Math.round(width * height * fraction),
    percent: (fraction * 100).toFixed(2),
  };
}

/** Ratio and areas shown for one timeline step. */
export function entryStats(
  entry: TimelineEntry,
  width: number,
  height: number,
) {
  const box = entry.data.box;
  return {
    ratio:
      box && height > 0 && box[3] > 0
        ? ((width / height) * (box[2] / box[3])).toFixed(2)
        : undefined,
    area: boxArea(box, width, height),
    attributeArea: boxArea(entry.data.attribute_box, width, height),
  };
}

export function percent(value: number | null | undefined) {
  return value === undefined || value === null
    ? undefined
    : `${(value * 100).toFixed(0)}%`;
}

/** Overlay line widths, scaled so they look alike at any resolution. */
export function overlayStrokes(width: number, height: number) {
  const scale = Math.sqrt((width * height) / (1280 * 720));
  const sized = (base: number, min: number) =>
    Math.max(min, Math.round(base * scale));
  return {
    path: sized(5, 1),
    pointRadius: sized(7, 2),
    pointStroke: sized(3, 1),
    zone: sized(5, 1),
    box: sized(5, 1),
    highlightRadius: sized(5, 2),
  };
}

/** Zone coordinates, stored as fractions, in overlay pixels. */
export function zonePolygon(
  coordinates: string | string[] | undefined,
  width: number,
  height: number,
) {
  if (!coordinates) return "";
  const text = Array.isArray(coordinates) ? coordinates.join(",") : coordinates;
  return text
    .split(",")
    .map((value, index) => Number(value) * (index % 2 ? height : width))
    .join(",");
}

function bgrToRgb(color: readonly number[] | undefined) {
  return color?.length === 3 ? `rgb(${[...color].reverse().join(",")})` : "";
}

/** Drawing color for a label, or a stable one derived from the object id. */
export function objectColor(
  config: FrigateConfig | undefined,
  label: string,
  id: string,
) {
  for (const model of config?.models ?? []) {
    const color = bgrToRgb(model.colormap?.[label]);
    if (color) return color;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = (id.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  return `hsl(${Math.abs(hash * 137.508) % 360}, 70%, 50%)`;
}

export function zoneColor(
  config: FrigateConfig | undefined,
  camera: string,
  zone: string,
) {
  return bgrToRgb(config?.cameras[camera]?.zones?.[zone]?.color);
}
