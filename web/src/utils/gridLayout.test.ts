import { describe, expect, it } from "vitest";
import { fitAllLayout } from "./gridLayout";

const wide = { aspect: 16 / 9 };

describe("fitAllLayout", () => {
  it("uses one column for a single camera", () => {
    expect(fitAllLayout([wide], 1600, 900).columns).toBe(1);
  });

  it("picks a 2x2 grid for four cameras on a 16:9 screen", () => {
    expect(fitAllLayout([wide, wide, wide, wide], 1600, 900).columns).toBe(2);
  });

  it("favours more columns on a very wide area", () => {
    expect(fitAllLayout([wide, wide, wide], 3000, 500).columns).toBe(3);
  });

  it("handles an unmeasured container", () => {
    expect(fitAllLayout([wide, wide], 0, 0).tileWidth).toBe(0);
  });
});
