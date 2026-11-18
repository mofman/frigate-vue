import { describe, expect, it } from "vitest";
import type { FrigateConfig } from "@/types/frigate";
import type { TimelineEntry } from "@/types/event";
import {
  clampOffset,
  detectTime,
  entryStats,
  nearestBoxEntry,
  objectColor,
  overlayStrokes,
  pathPoints,
  percent,
  recordTime,
  rowProgress,
  visiblePath,
  zoneColor,
  zonePolygon,
  zonesAt,
} from "./tracking";

function entry(
  timestamp: number,
  box?: [number, number, number, number],
  zones: string[] = [],
): TimelineEntry {
  return {
    camera: "front",
    timestamp,
    source: "tracked_object",
    source_id: "a",
    class_type: "visible",
    data: { camera: "front", label: "person", box, zones },
  };
}

describe("annotation offset", () => {
  it("converts between detect and recording time", () => {
    expect(recordTime(100, 500)).toBe(100.5);
    expect(detectTime(100.5, 500)).toBe(100);
    expect(recordTime(100, -1000)).toBe(99);
  });

  it("stays within its limits", () => {
    expect(clampOffset(20000)).toBe(10000);
    expect(clampOffset(-20000)).toBe(-10000);
  });
});

describe("object path", () => {
  const timeline = [entry(12, [0.2, 0.2, 0.2, 0.4]), entry(11)];
  const event = {
    data: {
      path_data: [
        [[0.1, 0.1], 10],
        [[0.9, 0.9], 13],
      ] as [[number, number], number][],
    },
  };

  it("merges saved points and steps in time order", () => {
    const points = pathPoints(event, timeline);
    expect(points.map((point) => point.timestamp)).toEqual([10, 12, 13]);
    expect(points[1]!.x).toBeCloseTo(0.3);
    expect(points[1]!.y).toBeCloseTo(0.6);
    expect(points[1]!.classType).toBe("visible");
  });

  it("reveals points as time passes", () => {
    const points = pathPoints(event, timeline);
    expect(visiblePath(points, 9, 10)).toHaveLength(0);
    expect(visiblePath(points, 12, 10)).toHaveLength(2);
    expect(visiblePath(points, 20, 10)).toHaveLength(3);
  });
});

describe("timeline lookups", () => {
  const timeline = [
    entry(10, [0, 0, 1, 1], ["yard"]),
    entry(20, undefined, ["yard", "door"]),
    entry(30, [0, 0, 0.5, 0.5]),
  ];

  it("finds a box only near its step", () => {
    expect(nearestBoxEntry(timeline, 10.02)?.timestamp).toBe(10);
    expect(nearestBoxEntry(timeline, 15)).toBeUndefined();
    expect(nearestBoxEntry(timeline, 20)).toBeUndefined();
  });

  it("uses the zones of the latest step", () => {
    expect(zonesAt(timeline, 5)).toEqual([]);
    expect(zonesAt(timeline, 25)).toEqual(["yard", "door"]);
  });

  it("fills the line between steps", () => {
    expect(rowProgress([10, 20, 40], 5)).toEqual([0, 0, 0]);
    expect(rowProgress([10, 20, 40], 15)).toEqual([0.5, 0, 0]);
    expect(rowProgress([10, 20, 40], 30)).toEqual([1, 0.5, 0]);
    expect(rowProgress([10, 10], 10)).toEqual([0, 0]);
  });
});

describe("step details", () => {
  it("computes ratio and area from the box", () => {
    const stats = entryStats(entry(1, [0, 0, 0.5, 0.25]), 1000, 500);
    expect(stats.ratio).toBe("4.00");
    expect(stats.area).toEqual({ pixels: 62500, percent: "12.50" });
    expect(stats.attributeArea).toBeUndefined();
  });

  it("leaves out what a step does not have", () => {
    expect(entryStats(entry(1), 1000, 500).ratio).toBeUndefined();
    expect(percent(undefined)).toBeUndefined();
    expect(percent(0.876)).toBe("88%");
  });
});

describe("overlay drawing", () => {
  it("scales strokes with resolution and keeps them visible", () => {
    expect(overlayStrokes(1280, 720).path).toBe(5);
    expect(overlayStrokes(2560, 1440).path).toBe(10);
    expect(overlayStrokes(10, 10).path).toBe(1);
  });

  it("converts zone coordinates to pixels", () => {
    expect(zonePolygon("0.5,0.25,1,1", 100, 200)).toBe("50,50,100,200");
    expect(zonePolygon(["0.5,0.5"], 100, 100)).toBe("50,50");
    expect(zonePolygon(undefined, 100, 100)).toBe("");
  });

  it("reads configured colors, which are stored as BGR", () => {
    const config = {
      models: [{ devices: [], colormap: { person: [1, 2, 3] } }],
      cameras: { front: { zones: { yard: { color: [4, 5, 6] } } } },
    } as unknown as FrigateConfig;
    expect(objectColor(config, "person", "a")).toBe("rgb(3,2,1)");
    expect(zoneColor(config, "front", "yard")).toBe("rgb(6,5,4)");
    expect(zoneColor(config, "front", "none")).toBe("");
  });

  it("falls back to the same color for the same object", () => {
    expect(objectColor(undefined, "dog", "abc")).toBe(
      objectColor(undefined, "dog", "abc"),
    );
  });
});
