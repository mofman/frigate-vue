import { describe, expect, it } from "vitest";
import { fitAllLayout, partitionRows, type TileRect } from "./gridLayout";

const wide = { aspect: 16 / 9 };
const portrait = { aspect: 9 / 16 };

function rowsOf(rects: TileRect[]) {
  return new Set(rects.map((rect) => Math.round(rect.y))).size;
}

describe("partitionRows", () => {
  it("keeps order and balances aspect sums", () => {
    expect(partitionRows([1, 1, 1, 1], 2)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(partitionRows([2, 0.5, 0.5, 1, 1, 2], 2)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ]);
  });
});

describe("fitAllLayout", () => {
  it("uses one row for a single camera", () => {
    const { rects } = fitAllLayout([wide], 1600, 900);
    expect(rects).toHaveLength(1);
  });

  it("picks a 2x2 grid for four cameras on a 16:9 screen", () => {
    expect(
      rowsOf(fitAllLayout([wide, wide, wide, wide], 1600, 900).rects),
    ).toBe(2);
  });

  it("favours one row on a very wide area", () => {
    expect(rowsOf(fitAllLayout([wide, wide, wide], 3000, 500).rects)).toBe(1);
  });

  it("keeps every tile's aspect ratio and fits inside the area", () => {
    const items = [wide, portrait, wide, { aspect: 4 / 3 }, wide, portrait];
    const { rects } = fitAllLayout(items, 1600, 900);
    rects.forEach((rect, i) => {
      expect(rect.width / rect.height).toBeCloseTo(items[i].aspect);
      expect(rect.x + rect.width).toBeLessThanOrEqual(1600);
      expect(rect.y + rect.height).toBeLessThanOrEqual(900);
    });
  });

  it("shares one height across a row", () => {
    const { rects } = fitAllLayout([wide, portrait, wide, wide], 1600, 900);
    const byRow = new Map<number, number[]>();
    for (const rect of rects) {
      const key = Math.round(rect.y);
      byRow.set(key, [...(byRow.get(key) ?? []), rect.height]);
    }
    for (const heights of byRow.values())
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.001);
  });

  it("handles an unmeasured container", () => {
    expect(fitAllLayout([wide, wide], 0, 0).rects).toEqual([]);
  });
});
