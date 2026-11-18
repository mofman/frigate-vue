import { describe, expect, it } from "vitest";
import {
  activeTags,
  applyTag,
  currentWord,
  dateTagValue,
  parseTagDate,
  parseTimeRange,
  removeTag,
  tagSuggestions,
  withoutLastWord,
  type TagContext,
} from "./exploreTags";

const context: TagContext = {
  hour12: false,
  dateOrder: "MDY",
  suggestions: {
    cameras: ["front", "back"],
    labels: ["person", "car"],
    search_type: ["thumbnail", "description"],
    has_clip: ["yes", "no"],
    has_snapshot: ["yes", "no"],
    before: [],
    after: [],
    time_range: [],
    min_score: [],
    max_score: [],
    min_speed: [],
    max_speed: [],
  },
};

describe("explore tag values", () => {
  it("adds known list values once", () => {
    const first = applyTag({}, "labels", "car", context);
    expect(first).toEqual({ filter: { labels: ["car"] } });
    const again = applyTag({ labels: ["car"] }, "labels", "car", context);
    expect(again).toEqual({ filter: { labels: ["car"] } });
  });

  it("rejects unknown values", () => {
    expect(applyTag({}, "labels", "dragon", context)).toBeNull();
    expect(applyTag({}, "has_clip", "maybe", context)).toBeNull();
  });

  it("turns yes and no into flags", () => {
    expect(applyTag({}, "has_clip", "no", context)).toEqual({
      filter: { has_clip: 0 },
    });
  });

  it("checks score and speed bounds and conflicts", () => {
    expect(applyTag({}, "min_score", "80", context)).toEqual({
      filter: { min_score: 0.8 },
    });
    expect(applyTag({}, "min_score", "20", context)).toBeNull();
    expect(applyTag({}, "max_speed", "151", context)).toBeNull();
    expect(applyTag({ max_score: 0.7 }, "min_score", "80", context)).toEqual({
      error: "minScoreMustBeLessOrEqualMaxScore",
    });
    expect(applyTag({ min_speed: 30 }, "max_speed", "20", context)).toEqual({
      error: "maxSpeedMustBeGreaterOrEqualMinSpeed",
    });
  });

  it("parses dates in the local order and rejects impossible ones", () => {
    const expected = new Date(2026, 10, 18).getTime() / 1000;
    expect(parseTagDate("11182026", "MDY")).toBe(expected);
    expect(parseTagDate("18112026", "DMY")).toBe(expected);
    expect(parseTagDate("20261118", "YMD")).toBe(expected);
    expect(parseTagDate("13012026", "MDY")).toBeUndefined();
    expect(parseTagDate("2026", "MDY")).toBeUndefined();
    expect(dateTagValue("YMD", 0, new Date(2026, 10, 18))).toBe("20261118");
  });

  it("keeps before after the after date", () => {
    const after = new Date(2026, 10, 18).getTime() / 1000;
    expect(applyTag({ after }, "before", "11172026", context)).toEqual({
      error: "beforeDateBeLaterAfter",
    });
  });

  it("normalizes time ranges", () => {
    expect(parseTimeRange("08:00-17:30", false)).toBe("08:00,17:30");
    expect(parseTimeRange("12:00AM-1:30PM", true)).toBe("00:00,13:30");
    expect(parseTimeRange("17:00-08:00", false)).toBeUndefined();
    expect(parseTimeRange("25:00-26:00", false)).toBeUndefined();
  });
});

describe("explore active tags", () => {
  it("lists each value and hides the similarity marker", () => {
    expect(
      activeTags({
        labels: ["car", "person"],
        min_score: 0.8,
        search_type: ["similarity"],
      }),
    ).toEqual([
      { key: "labels", value: "car" },
      { key: "labels", value: "person" },
      { key: "min_score", value: 0.8 },
    ]);
  });

  it("removes one value, then the key", () => {
    const filter = { labels: ["car", "person"] };
    const next = removeTag(filter, { key: "labels", value: "car" });
    expect(next).toEqual({ labels: ["person"] });
    expect(removeTag(next, { key: "labels", value: "person" })).toEqual({});
    expect(filter.labels).toHaveLength(2);
  });

  it("drops the submitted filter along with has_snapshot", () => {
    expect(
      removeTag(
        { has_snapshot: 1, is_submitted: 1 },
        { key: "has_snapshot", value: 1 },
      ),
    ).toEqual({});
  });
});

describe("explore search text", () => {
  it("finds the word being typed", () => {
    expect(currentWord("red car")).toEqual({ word: "car", ended: false });
    expect(currentWord("labels:car ")).toEqual({
      word: "labels:car",
      ended: true,
    });
    expect(withoutLastWord("red car labels:car")).toBe("red car");
  });

  it("offers keys and saved searches, then values", () => {
    expect(tagSuggestions("la", {}, context).items).toEqual(["labels"]);
    expect(tagSuggestions("h", {}, context, ["home"]).items).toEqual([
      "home",
      "has_clip",
      "has_snapshot",
    ]);
    expect(tagSuggestions("labels:", { labels: ["car"] }, context)).toEqual({
      key: "labels",
      items: ["person"],
    });
  });

  it("stops offering keys that are already fully used", () => {
    const items = tagSuggestions(
      "",
      { has_clip: 1, cameras: ["front", "back"] },
      context,
    ).items;
    expect(items).not.toContain("has_clip");
    expect(items).not.toContain("cameras");
    expect(items).toContain("labels");
  });
});
