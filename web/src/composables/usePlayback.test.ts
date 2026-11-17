import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePlayback } from "./usePlayback";

const now = 1_000_000;

describe("usePlayback revealRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now * 1000);
  });
  afterEach(() => vi.useRealTimers());

  it("is bumped by a seek the user makes", () => {
    const playback = usePlayback();
    playback.seek(now - 3600);
    expect(playback.revealRequest.value).toBe(1);
    expect(playback.mode.value).toBe("recording");
  });

  it("is bumped by a seek that lands in live", () => {
    const playback = usePlayback({ initialMode: "recording" });
    playback.seek(now);
    expect(playback.mode.value).toBe("live");
    expect(playback.revealRequest.value).toBe(1);
  });

  it("is bumped by going live and by releasing a scrub", () => {
    const playback = usePlayback();
    playback.goLive();
    playback.beginScrub();
    playback.scrubTo(now - 600);
    playback.endScrub();
    expect(playback.revealRequest.value).toBe(2);
  });

  it("is left alone by seeks the player makes on its own", () => {
    const playback = usePlayback();
    playback.seek(now - 3600);
    playback.seek(now - 3500, true, { reveal: false });
    expect(playback.revealRequest.value).toBe(1);
    expect(playback.time.value).toBe(now - 3500);
  });

  it("is left alone when recordings run out", () => {
    const playback = usePlayback({
      initialMode: "recording",
      initialTime: now - 3600,
    });
    playback.reportEnded();
    expect(playback.revealRequest.value).toBe(0);
    expect(playback.time.value).toBe(now - 3599);

    const nearLive = usePlayback({
      initialMode: "recording",
      initialTime: now - 20,
    });
    nearLive.reportEnded();
    expect(nearLive.mode.value).toBe("live");
    expect(nearLive.revealRequest.value).toBe(0);
  });
});
