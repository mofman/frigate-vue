import { describe, expect, it } from "vitest";
import type { ReviewSegment } from "@/types/frigate";
import {
  EVENT_PADDING,
  MIN_EXPORT_SECONDS,
  clampRange,
  defaultRange,
  moveEnd,
  moveStart,
  parseRangeParam,
  rangeAround,
  reviewAt,
  reviewRange,
} from "./exportRange";

const now = 1_000_000;
const bounds = { earliest: now - 24 * 3600, now };

const review = (start: number, end?: number) =>
  ({ id: `r${start}`, start_time: start, end_time: end }) as ReviewSegment;

describe("defaultRange", () => {
  it("selects the review under the playhead with padding", () => {
    const item = review(now - 500, now - 480);
    expect(
      defaultRange({ time: now - 490, live: false, bounds, review: item }),
    ).toEqual({
      start: now - 500 - EVENT_PADDING,
      end: now - 480 + EVENT_PADDING,
    });
  });

  it("selects the last minute when live", () => {
    expect(defaultRange({ time: now, live: true, bounds })).toEqual({
      start: now - 60,
      end: now,
    });
  });

  it("selects a minute around the playhead in a recording", () => {
    expect(defaultRange({ time: now - 3600, live: false, bounds })).toEqual({
      start: now - 3630,
      end: now - 3570,
    });
  });

  it("never runs past now", () => {
    const range = defaultRange({ time: now - 10, live: false, bounds });
    expect(range).toEqual({ start: now - 60, end: now });
  });
});

describe("reviewRange", () => {
  it("ends an in-progress review at now", () => {
    expect(reviewRange(review(now - 20), now).end).toBe(now);
  });

  it("finds the review covering a time", () => {
    const items = [review(now - 900, now - 880), review(now - 500, now - 480)];
    expect(reviewAt(items, now - 485, now)?.id).toBe(items[1]!.id);
    expect(reviewAt(items, now - 700, now)).toBeUndefined();
  });
});

describe("clampRange", () => {
  it("keeps the length when shifting into bounds", () => {
    expect(clampRange({ start: now - 30, end: now + 30 }, bounds)).toEqual({
      start: now - 60,
      end: now,
    });
    expect(
      clampRange(
        { start: bounds.earliest - 50, end: bounds.earliest + 10 },
        bounds,
      ),
    ).toEqual({ start: bounds.earliest, end: bounds.earliest + 60 });
  });

  it("shrinks a range longer than the bounds", () => {
    expect(clampRange({ start: 0, end: now * 2 }, bounds)).toEqual({
      start: bounds.earliest,
      end: now,
    });
  });

  it("centres presets on the playhead", () => {
    expect(rangeAround(now - 1000, 300, bounds)).toEqual({
      start: now - 1150,
      end: now - 850,
    });
  });
});

describe("moving edges", () => {
  const range = { start: now - 200, end: now - 100 };

  it("moves one edge and leaves the other", () => {
    expect(moveStart(range, now - 150, bounds)).toEqual({
      start: now - 150,
      end: now - 100,
    });
    expect(moveEnd(range, now - 120, bounds)).toEqual({
      start: now - 200,
      end: now - 120,
    });
  });

  it("pushes the other edge when they cross", () => {
    expect(moveStart(range, now - 50, bounds)).toEqual({
      start: now - 50,
      end: now - 50 + MIN_EXPORT_SECONDS,
    });
    expect(moveEnd(range, now - 300, bounds)).toEqual({
      start: now - 300 - MIN_EXPORT_SECONDS,
      end: now - 300,
    });
  });

  it("stays inside the bounds", () => {
    expect(moveEnd(range, now + 500, bounds).end).toBe(now);
    expect(moveStart(range, 0, bounds).start).toBe(bounds.earliest);
    expect(moveStart(range, now + 500, bounds)).toEqual({
      start: now - MIN_EXPORT_SECONDS,
      end: now,
    });
  });
});

describe("parseRangeParam", () => {
  it("reads start,end", () => {
    expect(parseRangeParam("100,160")).toEqual({ start: 100, end: 160 });
  });

  it("rejects anything else", () => {
    expect(parseRangeParam("160,100")).toBeUndefined();
    expect(parseRangeParam("abc")).toBeUndefined();
    expect(parseRangeParam(undefined)).toBeUndefined();
    expect(parseRangeParam(["1", "2"])).toBeUndefined();
  });
});
