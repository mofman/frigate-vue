/**
 * Range maths for the export selection, kept free of Vue so it can be
 * tested. Times are unix seconds.
 */
import type { ReviewSegment } from "@/types/frigate";

export type ExportRange = { start: number; end: number };
export type ExportBounds = { earliest: number; now: number };

/**
 * seconds kept either side of a review item, matching REVIEW_PADDING (not
 * imported so this module stays free of browser globals)
 */
export const EVENT_PADDING = 4;

/** shortest clip that can be selected, in seconds */
export const MIN_EXPORT_SECONDS = 1;

/** A review item with the same lead-in used when opening its recording. */
export function reviewRange(review: ReviewSegment, now: number): ExportRange {
  return {
    start: review.start_time - EVENT_PADDING,
    end: Math.min(now, (review.end_time ?? now) + EVENT_PADDING),
  };
}

/** The review item that covers `time`, if any. */
export function reviewAt(
  reviews: ReviewSegment[],
  time: number,
  now: number,
): ReviewSegment | undefined {
  return reviews.find((review) => {
    const { start, end } = reviewRange(review, now);
    return start <= time && time <= end;
  });
}

/** Move a range inside the bounds, keeping its length where it fits. */
export function clampRange(
  range: ExportRange,
  { earliest, now }: ExportBounds,
): ExportRange {
  const span = Math.max(
    MIN_EXPORT_SECONDS,
    Math.min(range.end - range.start, now - earliest),
  );
  const end = Math.min(now, Math.max(range.end, earliest + span));
  return { start: end - span, end };
}

/** A range of `seconds` centred on `time`, pulled back so it ends by now. */
export function rangeAround(
  time: number,
  seconds: number,
  bounds: ExportBounds,
): ExportRange {
  return clampRange(
    { start: time - seconds / 2, end: time + seconds / 2 },
    bounds,
  );
}

/** What to select when export starts with nothing chosen yet. */
export function defaultRange(input: {
  time: number;
  live: boolean;
  bounds: ExportBounds;
  review?: ReviewSegment;
}): ExportRange {
  const { time, live, bounds, review } = input;
  if (review) return clampRange(reviewRange(review, bounds.now), bounds);
  if (live)
    return clampRange({ start: bounds.now - 60, end: bounds.now }, bounds);
  return rangeAround(time, 60, bounds);
}

/** Drag the start edge. Passing the end pushes the end along. */
export function moveStart(
  range: ExportRange,
  time: number,
  { earliest, now }: ExportBounds,
): ExportRange {
  const start = Math.min(Math.max(time, earliest), now - MIN_EXPORT_SECONDS);
  return { start, end: Math.max(range.end, start + MIN_EXPORT_SECONDS) };
}

/** Drag the end edge. Passing the start pushes the start along. */
export function moveEnd(
  range: ExportRange,
  time: number,
  { earliest, now }: ExportBounds,
): ExportRange {
  const end = Math.max(Math.min(time, now), earliest + MIN_EXPORT_SECONDS);
  return { start: Math.min(range.start, end - MIN_EXPORT_SECONDS), end };
}

/** Parse the `?export=start,end` deep link. */
export function parseRangeParam(value: unknown): ExportRange | undefined {
  if (typeof value !== "string") return undefined;
  const [start, end] = value.split(",").map(Number);
  if (
    start === undefined ||
    end === undefined ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start
  )
    return undefined;
  return { start, end };
}
