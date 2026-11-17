/**
 * Scroll rules for the review timeline. Pure math, no Vue state.
 *
 * The playhead moves over a scrollable track. While the timeline follows it
 * ("attached"), forward playback carries the playhead up until it reaches its
 * hold line, then the track slides beneath it so the view never jumps.
 * Scrolling detaches; any user seek attaches again.
 */

/** fraction of the height the playhead is held at, at most */
export const HOLD_AT = 0.3;
/** closest the playhead line gets to an edge, so its pill stays whole */
export const MIN_HOLD = 16;
/** depth of the zones at the top and bottom that auto-scroll a drag */
export const EDGE_ZONE = 48;
/** auto-scroll speed at the very edge, css px per second */
export const EDGE_SPEED = 1500;
/** pointer travel that turns a press into a drag */
export const DRAG_SLOP = 3;
/** finger travel still counted as a tap */
export const TAP_SLOP = 6;
/** duration of an animated scroll */
export const SCROLL_MS = 280;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Where to hold a playhead that was placed at `viewY` in the view. */
export function holdLine(viewY: number, maxLine: number) {
  return clamp(viewY, MIN_HOLD, Math.max(MIN_HOLD, maxLine));
}

type ScrollInput = {
  /** playhead y in content coordinates */
  y: number;
  scrollTop: number;
  maxScroll: number;
};

/**
 * Scroll position that keeps a rising playhead on its hold line, or
 * undefined while it is still below the line.
 */
export function holdScroll({
  y,
  scrollTop,
  line,
  maxScroll,
}: ScrollInput & { line: number }) {
  if (y - scrollTop >= line) return undefined;
  const next = clamp(y - line, 0, maxScroll);
  return Math.abs(next - scrollTop) < 0.01 ? undefined : next;
}

/**
 * Scroll position that brings an off-screen playhead onto `line`, or
 * undefined when it is already in view.
 */
export function revealScroll({
  y,
  scrollTop,
  height,
  line,
  maxScroll,
}: ScrollInput & { height: number; line: number }) {
  const viewY = y - scrollTop;
  if (viewY >= 0 && viewY <= height) return undefined;
  return clamp(y - line, 0, maxScroll);
}

/**
 * Signed auto-scroll speed in px/s for a pointer dragging at `pointerY`,
 * negative towards the top. Ramps in with the depth into the edge zone.
 */
export function edgeSpeed(pointerY: number, top: number, bottom: number) {
  const intoTop = top + EDGE_ZONE - pointerY;
  if (intoTop > 0) return -EDGE_SPEED * Math.min(1, intoTop / EDGE_ZONE) ** 2;
  const intoBottom = pointerY - (bottom - EDGE_ZONE);
  if (intoBottom > 0)
    return EDGE_SPEED * Math.min(1, intoBottom / EDGE_ZONE) ** 2;
  return 0;
}

export function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}
