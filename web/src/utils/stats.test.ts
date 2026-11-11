import { describe, expect, it } from "vitest";
import type { FrigateStats } from "@/types/stats";
import {
  appendSnapshot,
  collectSeries,
  formatMiB,
  linePath,
  niceMax,
  pointIndex,
  thresholdLevel,
  toNumber,
} from "./stats";

function snapshot(
  updated: number,
  detectors: Record<string, { inference_speed: number; cpu?: string }>,
): FrigateStats {
  return {
    cameras: {},
    cpu_usages: {},
    detectors: Object.fromEntries(
      Object.entries(detectors).map(([key, value]) => [
        key,
        { detection_start: 0, pid: 1, ...value },
      ]),
    ),
    service: { last_updated: updated, uptime: 100, version: "0", storage: {} },
  };
}

describe("toNumber", () => {
  it("reads numbers sent as strings, with or without a percent sign", () => {
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber("40%")).toBe(40);
    expect(toNumber(3)).toBe(3);
  });

  it("returns null for anything that is not a number", () => {
    expect(toNumber("n/a")).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber(Number.NaN)).toBeNull();
  });
});

describe("collectSeries", () => {
  it("aligns values to the history index and fills gaps with null", () => {
    const history = [
      snapshot(1, { cpu: { inference_speed: 10 } }),
      snapshot(2, {
        cpu: { inference_speed: 12 },
        coral: { inference_speed: 8 },
      }),
    ];
    const series = collectSeries(
      history,
      (s) => s.detectors,
      (d) => d.inference_speed,
    );
    expect(series).toEqual([
      { key: "cpu", name: "cpu", values: [10, 12] },
      { key: "coral", name: "coral", values: [null, 8] },
    ]);
  });

  it("drops series that never have a value", () => {
    const history = [snapshot(1, { cpu: { inference_speed: 10 } })];
    expect(
      collectSeries(
        history,
        (s) => s.detectors,
        (d) => d.cpu,
      ),
    ).toEqual([]);
  });
});

describe("appendSnapshot", () => {
  const history = [snapshot(1, {}), snapshot(2, {})];

  it("slides the window forward by one", () => {
    const next = appendSnapshot(history, snapshot(3, {}));
    expect(next.map((s) => s.service.last_updated)).toEqual([2, 3]);
  });

  it("ignores repeated or older snapshots", () => {
    expect(appendSnapshot(history, snapshot(2, {}))).toBe(history);
    expect(appendSnapshot(history, snapshot(1, {}))).toBe(history);
  });

  it("waits for the seed history before appending", () => {
    expect(appendSnapshot([], snapshot(3, {}))).toEqual([]);
  });
});

describe("thresholdLevel", () => {
  const threshold = { warning: 50, error: 100 };

  it("classifies against the warning and error lines", () => {
    expect(thresholdLevel(10, threshold)).toBe("ok");
    expect(thresholdLevel(50, threshold)).toBe("warning");
    expect(thresholdLevel(150, threshold)).toBe("error");
    expect(thresholdLevel(null, threshold)).toBe("ok");
  });
});

describe("niceMax", () => {
  it("rounds up to a readable axis top", () => {
    expect(niceMax([7])).toBe(10);
    expect(niceMax([42])).toBe(50);
    expect(niceMax([180])).toBe(200);
    expect(niceMax([0.3])).toBe(0.5);
  });

  it("respects a floor and never returns zero", () => {
    expect(niceMax([10], 50)).toBe(50);
    expect(niceMax([])).toBe(1);
  });
});

describe("linePath", () => {
  it("draws across a 100 unit viewBox with y inverted", () => {
    expect(linePath([0, 50, 100], 100)).toBe(
      "M0.00 100.00L50.00 50.00L100.00 0.00",
    );
  });

  it("breaks the line at missing values", () => {
    expect(linePath([10, null, 10], 10)).toBe("M0.00 0.00M100.00 0.00");
  });

  it("clamps values above the axis top", () => {
    expect(linePath([200, 200], 100)).toBe("M0.00 0.00L100.00 0.00");
  });
});

describe("pointIndex", () => {
  it("maps a pointer fraction to the nearest point", () => {
    expect(pointIndex(0, 5)).toBe(0);
    expect(pointIndex(0.5, 5)).toBe(2);
    expect(pointIndex(1, 5)).toBe(4);
  });

  it("maps to the bar under the pointer for bar charts", () => {
    expect(pointIndex(0.99, 4, true)).toBe(3);
    expect(pointIndex(0.24, 4, true)).toBe(0);
  });

  it("clamps outside the plot", () => {
    expect(pointIndex(-1, 3)).toBe(0);
    expect(pointIndex(2, 3)).toBe(2);
    expect(pointIndex(0.5, 0)).toBe(-1);
  });
});

describe("formatMiB", () => {
  it("picks a unit", () => {
    expect(formatMiB(512)).toBe("512.00 MiB");
    expect(formatMiB(2048)).toBe("2.00 GiB");
    expect(formatMiB(1048576 * 3)).toBe("3.00 TiB");
    expect(formatMiB(undefined)).toBe("-");
  });
});
