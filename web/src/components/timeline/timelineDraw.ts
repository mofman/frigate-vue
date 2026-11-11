/**
 * Canvas painter for the review timeline. Pure drawing, no Vue state.
 *
 * The look follows the previous UI: the timeline is a stack of 8px rows,
 * ticks and labels run down the left edge, motion is a pair of thin bars
 * per row centred on a dotted spine, and review items tint their rows with
 * a severity gradient.
 */
import type {
  MotionData,
  ReviewSegment,
  UnavailableRange,
} from "@/types/frigate";

/** every row is this many css pixels tall, one row per segment */
export const ROW = 8;

export type ZoomLevel = {
  secondsPerPx: number;
  /** seconds per motion bucket requested from the api (half a row) */
  motionScale: number;
  /** seconds between minor ticks */
  tick: number;
  /** seconds between labelled ticks */
  label: number;
};

export const ZOOM_LEVELS: ZoomLevel[] = [
  { secondsPerPx: 30 / ROW, motionScale: 15, tick: 5 * 60, label: 15 * 60 },
  { secondsPerPx: 15 / ROW, motionScale: 8, tick: 60, label: 5 * 60 },
  { secondsPerPx: 5 / ROW, motionScale: 4, tick: 15, label: 60 },
];

export type Palette = {
  background: string;
  gap: string;
  motion: string;
  spine: string;
  tickMajor: string;
  tickMinor: string;
  tickFaint: string;
  label: string;
  alert: [string, string];
  detection: [string, string];
  significant: [string, string];
  font: string;
};

export function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    background: v("--bg-bar"),
    gap: v("--bg-stage"),
    motion: v("--motion-review"),
    spine: v("--motion-bar"),
    tickMajor: v("--tick-major"),
    tickMinor: v("--tick-minor"),
    tickFaint: v("--tick-faint"),
    label: v("--tick-major"),
    alert: [v("--severity-alert-dim"), v("--severity-alert")],
    detection: [v("--severity-detection-dim"), v("--severity-detection")],
    significant: [v("--severity-motion-dim"), v("--severity-motion")],
    font: v("--font-sans"),
  };
}

type Bucket = { motion: MotionData[]; unavailable: UnavailableRange[] };

export type DrawInput = {
  width: number;
  height: number;
  /** time at y = 0 of the viewport */
  topTime: number;
  secondsPerPx: number;
  now: number;
  earliest: number;
  zoom: ZoomLevel;
  buckets: Bucket[];
  reviews: ReviewSegment[];
  palette: Palette;
  formatLabel: (time: number, withSeconds: boolean) => string;
};

/** widest a motion bar gets, in css pixels */
const MOTION_MAX = 40;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function draw(ctx: CanvasRenderingContext2D, input: DrawInput) {
  const {
    width,
    height,
    topTime,
    secondsPerPx: spp,
    now,
    zoom,
    palette,
  } = input;
  const bottomTime = topTime - height * spp;
  const y = (time: number) => (topTime - time) / spp;
  const segment = ROW * spp;
  const half = segment / 2;
  const centre = Math.round(width / 2);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  // ---- recording gaps: darker rows ------------------------------------------
  const gaps: UnavailableRange[] = [];
  ctx.fillStyle = palette.gap;
  for (const bucket of input.buckets) {
    for (const gap of bucket.unavailable) {
      if (gap.end_time < bottomTime || gap.start_time > topTime) continue;
      gaps.push(gap);
      const y1 = y(gap.end_time);
      const y2 = y(gap.start_time);
      ctx.fillRect(0, y1, width, Math.max(1, y2 - y1));
    }
  }
  const inGap = (t: number) =>
    gaps.some((gap) => t >= gap.start_time && t < gap.end_time);

  // ---- review items: severity gradient across their rows ---------------------
  for (const review of input.reviews) {
    const end = review.end_time ?? now;
    if (end < bottomTime || review.start_time > topTime) continue;
    const [dim, full] =
      review.severity === "alert"
        ? palette.alert
        : review.severity === "detection"
          ? palette.detection
          : palette.significant;
    // snap to whole rows so bands line up with the ticks
    const y1 = Math.floor(y(end) / ROW) * ROW;
    const y2 = Math.ceil(y(review.start_time) / ROW) * ROW;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, dim);
    gradient.addColorStop(1, full);
    ctx.globalAlpha = review.has_been_reviewed ? 0.1 : 0.2;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y1, width, Math.max(ROW, y2 - y1));
    ctx.globalAlpha = 1;
  }

  // ---- motion: two thin bars per row, a dot where there was none ------------
  const motion = new Map<number, number>();
  for (const bucket of input.buckets) {
    for (const sample of bucket.motion) {
      const level = Math.max(sample.motion ?? 0, sample.audio ?? 0);
      if (level <= 0) continue;
      const key = Math.floor(sample.start_time / half) * half;
      motion.set(key, Math.max(motion.get(key) ?? 0, level));
    }
  }
  const firstHalf = Math.floor(Math.min(topTime, now) / half) * half;
  for (let t = firstHalf; t > bottomTime - half; t -= half) {
    if (t < input.earliest) break;
    if (t + half > now + half || inGap(t)) continue;
    // a 2px bar centred in the 4px half row
    const barY = y(t + half) + 1;
    const level = motion.get(t);
    if (level) {
      const w = Math.max(
        2,
        Math.round((MOTION_MAX * Math.min(level, 100)) / 100),
      );
      ctx.fillStyle = palette.motion;
      roundRect(ctx, centre - w / 2, barY, w, 2);
    } else {
      ctx.fillStyle = palette.spine;
      ctx.fillRect(centre - 0.5, barY, 1, 2);
    }
  }

  // ---- ticks and labels down the left edge -----------------------------------
  const minor = zoom.label === 15 * 60 ? 5 * 60 : 60;
  ctx.font = `500 9px ${palette.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const firstRow = Math.floor(Math.min(topTime, now) / segment) * segment;
  for (let t = firstRow; t > bottomTime - segment; t -= segment) {
    if (t < input.earliest) break;
    // the tick sits on the bottom edge of the row that starts at t
    const ty = Math.round(y(t)) - 2;
    let tickWidth = 5;
    ctx.fillStyle = palette.tickFaint;
    if (t % zoom.label === 0) {
      tickWidth = 12;
      ctx.fillStyle = palette.tickMajor;
    } else if (t % minor === 0) {
      tickWidth = 8;
      ctx.fillStyle = palette.tickMinor;
    }
    ctx.fillRect(0, ty, tickWidth, 2);
    if (t % zoom.label === 0) {
      ctx.fillStyle = palette.label;
      ctx.fillText(input.formatLabel(t, zoom.label < 60), 15, ty + 1);
    }
  }
}
