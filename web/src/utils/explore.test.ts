import { describe, expect, it, vi } from "vitest";
import type { ExploreRequest, TrackedEvent } from "@/types/event";

vi.mock("@/api/http", () => ({ apiBase: "http://frigate/api/" }));

const {
  EXPLORE_PAGE_SIZE,
  canLoadMore,
  exploreRequest,
  pageParams,
  parseExploreFilter,
  plainText,
  searchConfidence,
  serializeExploreFilter,
  sortOptions,
  uniqueEvents,
} = await import("./explore");

const options = { timezone: "UTC", defaultView: "summary" as const };

function event(id: string, start_time = 100): TrackedEvent {
  return {
    id,
    start_time,
    camera: "front",
    label: "person",
    has_clip: true,
    has_snapshot: true,
    zones: [],
    data: {},
  };
}

describe("explore url state", () => {
  it("reads the links the old interface produced", () => {
    expect(
      parseExploreFilter({
        labels: "person,car",
        recognized_license_plate: "ABC123",
        min_score: "0.8",
        has_clip: "1",
        search_type: "similarity",
        event_id: "1700000000.5-abc123",
        id: "ignored",
      }),
    ).toEqual({
      labels: ["person", "car"],
      recognized_license_plate: ["ABC123"],
      min_score: 0.8,
      has_clip: 1,
      search_type: ["similarity"],
      event_id: "1700000000.5-abc123",
    });
  });

  it("keeps commas inside a search query", () => {
    expect(parseExploreFilter({ query: "red, blue" }).query).toBe("red, blue");
  });

  it("ignores values that are not numbers", () => {
    expect(parseExploreFilter({ after: "soon" })).toEqual({});
  });

  it("round trips and drops empty values", () => {
    const query = serializeExploreFilter({
      cameras: ["a", "b"],
      labels: [],
      query: "",
      after: 0,
      sort: "score_desc",
    });
    expect(query).toEqual({ cameras: "a,b", after: "0", sort: "score_desc" });
    expect(parseExploreFilter(query)).toEqual({
      cameras: ["a", "b"],
      after: 0,
      sort: "score_desc",
    });
  });
});

describe("explore requests", () => {
  it("shows the summary when nothing is filtered", () => {
    expect(exploreRequest({}, options)).toBeNull();
  });

  it("lists events when the grid is the default view", () => {
    expect(exploreRequest({}, { ...options, defaultView: "grid" })?.path).toBe(
      "events",
    );
  });

  it("uses events for plain filters, without search only params", () => {
    const request = exploreRequest(
      { labels: ["car"], search_type: ["thumbnail"] },
      options,
    );
    expect(request?.path).toBe("events");
    expect(request?.params.labels).toBe("car");
    expect(request?.params.search_type).toBeUndefined();
  });

  it("searches for text and similar objects", () => {
    expect(exploreRequest({ query: "red car" }, options)).toMatchObject({
      path: "events/search",
      params: { query: "red car" },
    });
    const similar = exploreRequest(
      { search_type: ["similarity"], event_id: "1.0-a", query: "stale" },
      options,
    );
    expect(similar?.path).toBe("events/search");
    expect(similar?.params.query).toBeUndefined();
    expect(similar?.params.event_id).toBe("1.0-a");
  });
});

describe("explore paging", () => {
  const list: ExploreRequest = { path: "events", params: {} };
  const rows = [event("a", 300), event("b", 200)];

  it("starts without a cursor", () => {
    expect(pageParams(list)).toEqual({ limit: EXPLORE_PAGE_SIZE });
  });

  it("pages date sorts by start time", () => {
    expect(pageParams(list, rows).before).toBe(200);
    expect(pageParams(list, rows).offset).toBeUndefined();
    const ascending = { path: "events", params: { sort: "date_asc" } } as const;
    expect(pageParams(ascending, rows).after).toBe(200);
  });

  it("pages other sorts by offset", () => {
    const byScore = {
      path: "events",
      params: { sort: "score_desc" },
    } as const;
    expect(pageParams(byScore, rows)).toMatchObject({ offset: 2 });
    expect(pageParams(byScore, rows).before).toBeUndefined();
    const search = { path: "events/search", params: { query: "x" } } as const;
    expect(pageParams(search, rows)).toMatchObject({ offset: 2 });
  });

  it("stops on a short page and at the search cap", () => {
    const search = { path: "events/search", params: {} } as const;
    expect(canLoadMore(list, EXPLORE_PAGE_SIZE, 500)).toBe(true);
    expect(canLoadMore(list, EXPLORE_PAGE_SIZE - 1, 24)).toBe(false);
    expect(canLoadMore(search, EXPLORE_PAGE_SIZE, 75)).toBe(true);
    expect(canLoadMore(search, EXPLORE_PAGE_SIZE, 100)).toBe(false);
  });

  it("drops events repeated across pages", () => {
    expect(
      uniqueEvents([event("a"), event("b"), event("a")]).map((e) => e.id),
    ).toEqual(["a", "b"]);
  });
});

describe("explore search details", () => {
  it("converts distances to confidence", () => {
    expect(searchConfidence(0.25, true)).toBe(75);
    expect(searchConfidence(0, false)).toBe(50);
  });

  it("reduces marked up translations to text", () => {
    expect(plainText("Will <em>NOT</em> go.<br /><br />Sure?")).toBe(
      "Will NOT go.\n\nSure?",
    );
  });

  it("offers speed and relevance sorts only when they apply", () => {
    expect(sortOptions({})).not.toContain("relevance");
    expect(sortOptions({})).not.toContain("speed_desc");
    expect(sortOptions({ query: "x" })).toContain("relevance");
    expect(sortOptions({ min_speed: 5 })).toContain("speed_desc");
  });
});
