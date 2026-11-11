import { describe, expect, it } from "vitest";
import {
  inpointOffset,
  nextRecorded,
  seekPosition,
  timestampAt,
  vodWindow,
} from "./vod";

const spans = [
  { start_time: 100, end_time: 110, duration: 10 },
  { start_time: 110, end_time: 120, duration: 10 },
  // gap from 120 to 200
  { start_time: 200, end_time: 210, duration: 10.5 }, // 0.5s keyframe lead-in
];

describe("seekPosition", () => {
  it("sums whole segments before the target", () => {
    expect(seekPosition(115, spans)).toBe(15);
  });

  it("accounts for lead-in inside a segment", () => {
    expect(seekPosition(205, spans)).toBeCloseTo(20 + 0.5 + 5);
  });

  it("returns undefined outside the recorded range", () => {
    expect(seekPosition(50, spans)).toBeUndefined();
    expect(seekPosition(500, spans)).toBeUndefined();
  });

  it("subtracts the inpoint offset", () => {
    expect(seekPosition(115, spans, 5)).toBe(10);
  });
});

describe("timestampAt", () => {
  it("inverts seekPosition", () => {
    for (const ts of [101, 109.5, 115, 203, 209]) {
      const position = seekPosition(ts, spans)!;
      expect(timestampAt(position, spans)).toBeCloseTo(ts, 5);
    }
  });
});

describe("inpointOffset", () => {
  it("is the trimmed part of a segment crossing the window start", () => {
    expect(inpointOffset(104, spans[0])).toBe(4);
    expect(inpointOffset(90, spans[0])).toBe(0);
  });
});

describe("nextRecorded", () => {
  it("skips forward over gaps", () => {
    expect(nextRecorded(150, spans)).toBe(200);
    expect(nextRecorded(105, spans)).toBe(105);
    expect(nextRecorded(300, spans)).toBeUndefined();
  });
});

describe("vodWindow", () => {
  it("aligns to the hour and never extends past now", () => {
    const now = 10 * 3600 + 1200;
    expect(vodWindow(10 * 3600 + 600, now)).toEqual({
      after: 9 * 3600,
      before: now,
    });
    expect(vodWindow(5 * 3600 + 10, now)).toEqual({
      after: 4 * 3600,
      before: 7 * 3600,
    });
  });

  it("keeps the same window for seeks inside one hour", () => {
    const now = 20 * 3600;
    expect(vodWindow(5 * 3600 + 5, now)).toEqual(
      vodWindow(5 * 3600 + 3000, now),
    );
  });
});
