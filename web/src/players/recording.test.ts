import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

// node has no MSE, so the player takes its native HLS path
vi.mock("hls.js", () => ({ default: { isSupported: () => false } }));
vi.mock("@/api/baseUrl", () => ({ baseUrl: "http://frigate/" }));
vi.mock("@/api/http", () => ({
  http: { get },
  HttpError: class HttpError extends Error {
    status = 0;
  },
}));

import { RecordingPlayer } from "./recording";

/** Just enough of a video element for the player. */
class FakeVideo extends EventTarget {
  currentTime = 0;
  readyState = 0;
  seeking = false;
  paused = true;
  muted = true;
  playsInline = false;
  preload = "";
  src = "";
  defaultPlaybackRate = 1;
  playbackRate = 1;
  volume = 1;
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {}
  removeAttribute() {}
}

const hour = 1_700_000_000 - (1_700_000_000 % 3600);

describe("RecordingPlayer timestamps", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime((hour + 4 * 3600) * 1000);
    // one unbroken recording across whatever window is asked for
    get.mockImplementation(
      async (_url: string, init: { params: Record<string, number> }) => {
        const { after, before } = init.params as {
          after: number;
          before: number;
        };
        return {
          timelines: {
            auto: [
              {
                start_time: after,
                end_time: before,
                duration: (before - after) * 1000,
              },
            ],
          },
        };
      },
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    get.mockReset();
  });

  it("ignores the element position while a new source is still landing", async () => {
    const video = new FakeVideo();
    const player = new RecordingPlayer(video as unknown as HTMLVideoElement);

    const first = hour + 600;
    await player.prepare("front_door", first, { play: true });
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("timeupdate"));
    expect(player.timestamp.value).toBeCloseTo(first);

    // a seek hours away swaps the source; the element resets to 0 and fires
    // timeupdate before the new playlist has reached its target
    const target = hour - 3 * 3600 + 900;
    await player.prepare("front_door", target, { play: true });
    expect(player.timestamp.value).toBe(target);
    video.currentTime = 0;
    video.dispatchEvent(new Event("timeupdate"));
    expect(player.timestamp.value).toBe(target);

    // once the seek lands, the element's position is the truth again
    video.dispatchEvent(new Event("loadedmetadata"));
    video.dispatchEvent(new Event("timeupdate"));
    expect(player.timestamp.value).toBeCloseTo(target);
  });
});
