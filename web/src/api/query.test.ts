import { describe, expect, it } from "vitest";

// the api base url reads window.location at import time
Object.assign(globalThis, {
  window: { location: { protocol: "http:", host: "localhost" } },
});
const { __test } = await import("./query");

describe("query key serialization", () => {
  it("is stable regardless of param order", () => {
    expect(__test.serialize(["review", { b: 2, a: 1 }])).toBe(
      __test.serialize(["review", { a: 1, b: 2 }]),
    );
  });

  it("drops undefined params so optional filters share a key", () => {
    expect(__test.serialize(["review", { a: 1, b: undefined }])).toBe(
      "review?a=1",
    );
  });

  it("passes plain string keys through", () => {
    expect(__test.serialize("config")).toBe("config");
  });
});
