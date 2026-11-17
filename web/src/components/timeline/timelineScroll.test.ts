import { describe, expect, it } from "vitest";
import {
  EDGE_SPEED,
  EDGE_ZONE,
  MIN_HOLD,
  easeOutCubic,
  edgeSpeed,
  holdLine,
  holdScroll,
  revealScroll,
} from "./timelineScroll";

describe("holdLine", () => {
  it("holds where the playhead was placed when that is high enough", () => {
    expect(holdLine(80, 120)).toBe(80);
  });

  it("caps the line so a low playhead rises before it is held", () => {
    expect(holdLine(500, 120)).toBe(120);
  });

  it("keeps the pill clear of the top edge", () => {
    expect(holdLine(3, 120)).toBe(MIN_HOLD);
    expect(holdLine(-40, 120)).toBe(MIN_HOLD);
  });

  it("never caps below the edge margin on a tiny timeline", () => {
    expect(holdLine(10, 4)).toBe(MIN_HOLD);
  });
});

describe("holdScroll", () => {
  const base = { scrollTop: 1000, line: 120, maxScroll: 5000 };

  it("leaves a playhead below its line alone", () => {
    expect(holdScroll({ ...base, y: 1300 })).toBeUndefined();
    expect(holdScroll({ ...base, y: 1120 })).toBeUndefined();
  });

  it("slides the track so a rising playhead stays on its line", () => {
    expect(holdScroll({ ...base, y: 1119 })).toBe(999);
    expect(holdScroll({ ...base, y: 900 })).toBe(780);
  });

  it("cannot scroll above the top of the timeline", () => {
    expect(holdScroll({ ...base, scrollTop: 4, y: 100 })).toBe(0);
    expect(holdScroll({ ...base, scrollTop: 0, y: 100 })).toBeUndefined();
  });
});

describe("revealScroll", () => {
  const base = { scrollTop: 1000, height: 600, line: 180, maxScroll: 5000 };

  it("does nothing while the playhead is anywhere in view", () => {
    expect(revealScroll({ ...base, y: 1000 })).toBeUndefined();
    expect(revealScroll({ ...base, y: 1590 })).toBeUndefined();
    expect(revealScroll({ ...base, y: 1600 })).toBeUndefined();
  });

  it("brings a playhead above the view onto the line", () => {
    expect(revealScroll({ ...base, y: 400 })).toBe(220);
  });

  it("brings a playhead below the view onto the line", () => {
    expect(revealScroll({ ...base, y: 3000 })).toBe(2820);
  });

  it("clamps to the scrollable range", () => {
    expect(revealScroll({ ...base, y: 50, scrollTop: 900 })).toBe(0);
    expect(revealScroll({ ...base, y: 9000 })).toBe(5000);
  });
});

describe("edgeSpeed", () => {
  const top = 100;
  const bottom = 700;

  it("is still in the middle of the timeline", () => {
    expect(edgeSpeed(400, top, bottom)).toBe(0);
    expect(edgeSpeed(top + EDGE_ZONE, top, bottom)).toBe(0);
    expect(edgeSpeed(bottom - EDGE_ZONE, top, bottom)).toBe(0);
  });

  it("scrolls up near the top and down near the bottom", () => {
    expect(edgeSpeed(top + 10, top, bottom)).toBeLessThan(0);
    expect(edgeSpeed(bottom - 10, top, bottom)).toBeGreaterThan(0);
  });

  it("ramps with the depth into the zone", () => {
    const shallow = edgeSpeed(bottom - EDGE_ZONE + 5, top, bottom);
    const deep = edgeSpeed(bottom - 5, top, bottom);
    expect(deep).toBeGreaterThan(shallow);
  });

  it("is capped once the pointer leaves the timeline", () => {
    expect(edgeSpeed(bottom, top, bottom)).toBe(EDGE_SPEED);
    expect(edgeSpeed(bottom + 400, top, bottom)).toBe(EDGE_SPEED);
    expect(edgeSpeed(top - 400, top, bottom)).toBe(-EDGE_SPEED);
  });
});

describe("easeOutCubic", () => {
  it("runs from 0 to 1", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
