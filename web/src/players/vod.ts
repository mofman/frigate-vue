/**
 * Pure helpers mapping between wall clock time and positions inside a VOD
 * playlist made of concatenated recording segments.
 */
import type { RecordingSpan } from "@/types/frigate";

/**
 * The VOD endpoint trims the first segment to the window start, so playlist
 * position zero is the window start rather than the first segment's start.
 */
export function inpointOffset(
  windowStart: number,
  first: RecordingSpan | undefined,
) {
  if (!first) return 0;
  if (first.start_time < windowStart && first.end_time > windowStart) {
    return windowStart - first.start_time;
  }
  return 0;
}

/** Playlist seconds for a wall clock timestamp, or undefined when not recorded. */
export function seekPosition(
  timestamp: number,
  spans: RecordingSpan[],
  offset = 0,
): number | undefined {
  if (!spans.length) return undefined;
  const first = spans[0]!;
  const last = spans[spans.length - 1]!;
  if (timestamp < first.start_time || timestamp > last.end_time)
    return undefined;

  let seconds = 0;
  for (const span of spans) {
    if (span.start_time > timestamp) break;
    // skipped clips have no playlist media; a seek inside one lands on the
    // next clip that plays
    if (span.duration === 0) continue;
    const wall = span.end_time - span.start_time;
    const leadIn = Math.max(0, span.duration - wall);
    if (span.end_time < timestamp) {
      seconds += span.duration;
      continue;
    }
    seconds += leadIn + (timestamp - span.start_time);
  }

  seconds -= offset;
  return seconds >= 0 ? seconds : undefined;
}

/** Wall clock timestamp for a playlist position. Inverse of seekPosition. */
export function timestampAt(
  position: number,
  spans: RecordingSpan[],
  offset = 0,
): number | undefined {
  let remaining = position + offset;
  for (const span of spans) {
    if (span.duration === 0) continue;
    if (remaining <= span.duration) {
      const wall = span.end_time - span.start_time;
      const leadIn = Math.max(0, span.duration - wall);
      return span.start_time + Math.max(0, remaining - leadIn);
    }
    remaining -= span.duration;
  }
  return spans.at(-1)?.end_time;
}

/** Find the first recorded instant at or after the timestamp. */
export function nextRecorded(
  timestamp: number,
  spans: RecordingSpan[],
): number | undefined {
  for (const span of spans) {
    if (span.duration === 0) continue;
    if (span.end_time >= timestamp) return Math.max(span.start_time, timestamp);
  }
  return undefined;
}

export const VOD_WINDOW = 60 * 60;

/**
 * Window of recordings to load for a target time: up to an hour each side,
 * never past `now`. Aligned to the hour so consecutive seeks within the same
 * hour reuse the same playlist.
 */
export function vodWindow(target: number, now: number) {
  const hour = Math.floor(target / 3600) * 3600;
  const after = hour - VOD_WINDOW;
  const before = Math.min(hour + 2 * VOD_WINDOW, Math.floor(now));
  return { after, before };
}
