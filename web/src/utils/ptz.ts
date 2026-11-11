/** Click and drag to move maths for PTZ cameras with relative FOV moves. */

/** drags shorter than this are treated as a click */
export const PTZ_DRAG_MIN_PX = 15;

type Point = { x: number; y: number };
type Size = { width: number; height: number };

/**
 * The ONVIF relative move for a click (pan/tilt to that point) or a dragged
 * box (centre on it and zoom by its size). Dragging top left to bottom right
 * zooms in, the reverse zooms out.
 */
export function relativeMoveCommand(
  origin: Point,
  end: Point,
  size: Size,
): string | undefined {
  if (!size.width || !size.height) return undefined;
  const distX = Math.abs(end.x - origin.x);
  const distY = Math.abs(end.y - origin.y);

  if (distX < PTZ_DRAG_MIN_PX && distY < PTZ_DRAG_MIN_PX) {
    const pan = (end.x / size.width - 0.5) * 2;
    const tilt = (0.5 - end.y / size.height) * 2;
    return `move_relative_${pan}_${tilt}`;
  }

  const n0x = Math.min(origin.x, end.x) / size.width;
  const n0y = Math.min(origin.y, end.y) / size.height;
  const n1x = Math.max(origin.x, end.x) / size.width;
  const n1y = Math.max(origin.y, end.y) / size.height;

  // match the frame's aspect ratio so the zoom is uniform
  let boxW = n1x - n0x;
  let boxH = n1y - n0y;
  const frameAspect = size.width / size.height;
  if (boxW / boxH > frameAspect) boxH = boxW / frameAspect;
  else boxW = boxH * frameAspect;

  const pan = ((n0x + n1x) / 2 - 0.5) * 2;
  const tilt = (0.5 - (n0y + n1y) / 2) * 2;
  let zoom = Math.max(0.01, Math.min(1, Math.max(boxW, boxH)));
  if (!(end.x > origin.x && end.y > origin.y)) zoom = -zoom;
  return `move_relative_${pan}_${tilt}_${zoom}`;
}
