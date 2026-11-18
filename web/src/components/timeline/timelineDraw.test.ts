import { describe, expect, it } from "vitest";
import { draw, ROW, ZOOM_LEVELS, type Palette } from "./timelineDraw";

const zoom = ZOOM_LEVELS[0]!;
const spp = zoom.secondsPerPx;
const WIDTH = 100;
const NOW = 3_599_850;
const HOUR_END = 3_600_000;
const NOW_Y = 16 * ROW - 8;
// the top of the view sits NOW_Y px above now
const TOP_TIME = NOW + NOW_Y * spp;

const palette: Palette = {
  background: "background",
  gap: "gap",
  motion: "motion",
  spine: "spine",
  tickMajor: "tick",
  tickMinor: "tick",
  tickFaint: "tick",
  label: "label",
  alert: ["dim", "full"],
  detection: ["dim", "full"],
  significant: ["dim", "full"],
  font: "sans-serif",
};

/** Draw the given gaps and return the rectangles painted in the gap color. */
function gapRects(unavailable: { start_time: number; end_time: number }[]) {
  const rects: { y: number; height: number }[] = [];
  const ctx = {
    fillStyle: "",
    globalAlpha: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
    clearRect() {},
    beginPath() {},
    roundRect() {},
    fill() {},
    fillText() {},
    fillRect(_x: number, y: number, _w: number, height: number) {
      if (this.fillStyle === "gap") rects.push({ y, height });
    },
  };
  draw(ctx as unknown as CanvasRenderingContext2D, {
    width: WIDTH,
    height: 400,
    topTime: TOP_TIME,
    secondsPerPx: spp,
    now: NOW,
    earliest: 0,
    zoom,
    buckets: [{ motion: [], unavailable }],
    reviews: [],
    palette,
    formatLabel: () => "",
  });
  return rects;
}

describe("recording gaps", () => {
  it("stops a gap at now when it runs to the end of the hour", () => {
    const start = NOW - 60;
    expect(gapRects([{ start_time: start, end_time: HOUR_END }])).toEqual([
      { y: NOW_Y, height: 60 / spp },
    ]);
  });

  it("does not paint a gap that is entirely in the future", () => {
    expect(gapRects([{ start_time: NOW + 30, end_time: HOUR_END }])).toEqual(
      [],
    );
  });

  it("paints a gap in the past at its full size", () => {
    const end = NOW - 120;
    expect(gapRects([{ start_time: end - 60, end_time: end }])).toEqual([
      { y: NOW_Y + 120 / spp, height: 60 / spp },
    ]);
  });
});
