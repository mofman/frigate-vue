import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECORDING_LAG,
  ENTER_LIVE,
  LEAVE_LIVE,
  clampScrub,
  liveEdge,
  modeForTarget,
} from "./playback";

const now = 1_000_000;

describe("modeForTarget", () => {
  it("stays live for small moves back from now", () => {
    expect(modeForTarget("live", now - LEAVE_LIVE + 1, now)).toBe("live");
  });

  it("leaves live once the move is deliberate", () => {
    expect(modeForTarget("live", now - LEAVE_LIVE - 1, now)).toBe("recording");
  });

  it("enters live near the edge of recorded media", () => {
    const edge = liveEdge(now);
    expect(modeForTarget("recording", edge - ENTER_LIVE + 0.5, now)).toBe(
      "live",
    );
    expect(modeForTarget("recording", edge - ENTER_LIVE - 5, now)).toBe(
      "recording",
    );
  });

  it("has a gap between the thresholds so dragging near now cannot flap", () => {
    // a point that is recording when coming from recording...
    const target = now - DEFAULT_RECORDING_LAG - ENTER_LIVE - 1;
    expect(modeForTarget("recording", target, now)).toBe("recording");
    // ...is also recording when coming from live, so no oscillation
    expect(modeForTarget("live", target, now)).toBe("recording");
  });
});

describe("liveEdge", () => {
  it("never reports an edge older than the conservative lag", () => {
    expect(liveEdge(now, now - 3600)).toBe(now - DEFAULT_RECORDING_LAG);
    expect(liveEdge(now, now - 2)).toBe(now - 2);
  });
});

describe("clampScrub", () => {
  it("keeps scrubs inside the timeline", () => {
    expect(clampScrub(now + 50, now, now - 100)).toBe(now);
    expect(clampScrub(now - 500, now, now - 100)).toBe(now - 100);
  });
});
