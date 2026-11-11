/**
 * Live vs recording decision logic, kept free of Vue so it can be tested.
 *
 * Two thresholds give the decision hysteresis. Landing within ENTER_LIVE of
 * the live edge switches to live. Leaving live needs a deliberate move more
 * than LEAVE_LIVE back. Dragging around "now" therefore never flaps between
 * players.
 */

export type PlaybackMode = "live" | "recording";

/** seconds from the live edge that count as "now" */
export const ENTER_LIVE = 3;
/** seconds back from now needed to leave live */
export const LEAVE_LIVE = 8;
/** recordings land in ~10s segments, so the edge of recorded media trails now */
export const DEFAULT_RECORDING_LAG = 12;

/**
 * The newest instant that can be played from recordings. Uses the latest
 * known recording end when available, otherwise a conservative lag.
 */
export function liveEdge(now: number, recordedUntil?: number) {
  const estimate = now - DEFAULT_RECORDING_LAG;
  if (recordedUntil === undefined) return estimate;
  // a stale window end must not make the edge look older than it is
  return Math.max(recordedUntil, estimate);
}

/** Which mode a seek to `target` should land in. */
export function modeForTarget(
  current: PlaybackMode,
  target: number,
  now: number,
  recordedUntil?: number,
): PlaybackMode {
  if (current === "live") {
    return now - target > LEAVE_LIVE ? "recording" : "live";
  }
  return target >= liveEdge(now, recordedUntil) - ENTER_LIVE
    ? "live"
    : "recording";
}

/** Clamp a scrub position to the playable range. */
export function clampScrub(target: number, now: number, earliest: number) {
  return Math.min(Math.max(target, earliest), now);
}
