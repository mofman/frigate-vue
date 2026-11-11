/** Canvas painter for the review timeline. Pure drawing, no Vue state. */
import type {
  MotionData,
  ReviewSegment,
  UnavailableRange,
} from "@/types/frigate";

export type ZoomLevel = {
  secondsPerPx: number;
  /** seconds per motion bucket requested from the api */
  motionScale: number;
  /** seconds between minor ticks */
  tick: number;
  /** seconds between labelled ticks */
  label: number;
};

export const ZOOM_LEVELS: ZoomLevel[] = [
  { secondsPerPx: 30 / 8, motionScale: 15, tick: 5 * 60, label: 15 * 60 },
  { secondsPerPx: 15 / 8, motionScale: 8, tick: 60, label: 5 * 60 },
  { secondsPerPx: 5 / 8, motionScale: 4, tick: 15, label: 60 },
];

export type Palette = {
  background: string;
  gap: string;
  motion: string;
  motionActive: string;
  tickMajor: string;
  tickMinor: string;
  label: string;
  alert: string;
  detection: string;
  font: string;
};

export function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const v = (name: string) => style.getPropertyValue(name).trim();
  return {
    background: v("--bg-bar"),
    gap: v("--bg-stage"),
    motion: v("--motion-bar"),
    motionActive: v("--accent-strong"),
    tickMajor: v("--tick-major"),
    tickMinor: v("--tick-faint"),
    label: v("--text-tertiary"),
    alert: v("--warning"),
    detection: v("--accent"),
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

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  const trackLeft = 14;
  const trackRight = width - 44;
  const trackWidth = Math.max(0, trackRight - trackLeft);
  const centre = trackLeft + trackWidth / 2;

  // recording gaps
  ctx.fillStyle = palette.gap;
  for (const bucket of input.buckets) {
    for (const gap of bucket.unavailable) {
      if (gap.end_time < bottomTime || gap.start_time > topTime) continue;
      const y1 = y(gap.end_time);
      const y2 = y(gap.start_time);
      ctx.fillRect(trackLeft, y1, trackWidth, Math.max(1, y2 - y1));
    }
  }

  // review spans: tinted band plus a severity stripe on the left edge
  for (const review of input.reviews) {
    const end = review.end_time ?? now;
    if (end < bottomTime || review.start_time > topTime) continue;
    const color =
      review.severity === "alert" ? palette.alert : palette.detection;
    const y1 = y(end);
    const y2 = y(review.start_time);
    const h = Math.max(2, y2 - y1);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = color;
    ctx.fillRect(trackLeft, y1, trackWidth, h);
    ctx.globalAlpha = 1;
    ctx.fillRect(4, y1, 4, h);
  }

  // motion, mirrored around the centre line
  const barHeight = Math.max(1, zoom.motionScale / spp - 1);
  for (const bucket of input.buckets) {
    for (const sample of bucket.motion) {
      const t = sample.start_time;
      if (t + zoom.motionScale < bottomTime || t > topTime) continue;
      const level = Math.max(sample.motion ?? 0, sample.audio ?? 0);
      if (level <= 0) continue;
      const w = Math.max(2, (trackWidth * Math.min(level, 100)) / 100);
      ctx.fillStyle = level > 60 ? palette.motionActive : palette.motion;
      ctx.fillRect(centre - w / 2, y(t + zoom.motionScale), w, barHeight);
    }
  }

  // ticks and labels down the right edge
  ctx.font = `500 9px ${palette.font}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const firstTick = Math.floor(topTime / zoom.tick) * zoom.tick;
  for (let t = firstTick; t >= bottomTime - zoom.tick; t -= zoom.tick) {
    if (t < input.earliest) break;
    const ty = Math.round(y(t)) + 0.5;
    const labelled = t % zoom.label === 0;
    const hour = t % 3600 === 0;
    ctx.strokeStyle = labelled ? palette.tickMajor : palette.tickMinor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width - (hour ? 12 : labelled ? 8 : 5), ty);
    ctx.lineTo(width, ty);
    ctx.stroke();
    if (labelled && t <= now) {
      ctx.fillStyle = palette.label;
      ctx.fillText(input.formatLabel(t, zoom.label < 60), width - 14, ty);
    }
  }
}
