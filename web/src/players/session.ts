/**
 * Common shape for live stream sessions (MSE, WebRTC, jsmpeg).
 *
 * A session owns its media element. Components never create players directly,
 * they lease a session from the pool and re-parent its element into their own
 * container. This lets a stream survive a route change or a mode switch
 * without reconnecting.
 */
import { shallowRef, type ShallowRef } from "vue";

export type LiveMode = "mse" | "webrtc" | "jsmpeg";

export type LiveStatus = "idle" | "connecting" | "playing" | "error";

export type LiveError =
  "startup" | "stalled" | "mse-decode" | "mse-codec" | "unsupported";

export type Resolution = { width: number; height: number };

export abstract class LiveSession {
  readonly status: ShallowRef<LiveStatus> = shallowRef("idle");
  readonly error: ShallowRef<LiveError | undefined> = shallowRef();
  readonly resolution: ShallowRef<Resolution | undefined> = shallowRef();
  /** bumps each time a frame is presented after (re)connecting */
  readonly firstFrameAt: ShallowRef<number> = shallowRef(0);

  abstract readonly element: HTMLElement;

  constructor(
    readonly mode: LiveMode,
    readonly stream: string,
  ) {}

  abstract connect(): void;
  abstract disconnect(): void;

  /** Called when the element becomes the visible layer again. */
  resume() {}

  /** Called when the element is kept warm but hidden. */
  park() {}

  setMuted(_muted: boolean) {}

  setVolume(_volume: number) {}

  destroy() {
    this.disconnect();
    this.element.remove();
  }

  protected fail(error: LiveError, description: string) {
    // eslint-disable-next-line no-console
    console.error(
      `${this.stream} - ${this.mode} error '${error}': ${description} See the documentation: https://docs.frigate.video/configuration/live/#live-player-error-messages`,
    );
    this.error.value = error;
    this.status.value = "error";
  }

  protected markPlaying() {
    if (this.status.value !== "playing") {
      this.status.value = "playing";
    }
  }

  /** Wait for an actual presented frame, not just the playing event. */
  protected watchFirstFrame(video: HTMLVideoElement) {
    const done = () => {
      this.firstFrameAt.value = performance.now();
      this.markPlaying();
    };
    const withFrames = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
    };
    if (typeof withFrames.requestVideoFrameCallback === "function") {
      withFrames.requestVideoFrameCallback(() => done());
    } else {
      video.addEventListener("playing", done, { once: true });
    }
  }
}

export function createVideoElement(): HTMLVideoElement {
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  video.preload = "auto";
  video.disableRemotePlayback = true;
  video.className = "live-media";
  return video;
}

export function playMuted(video: HTMLVideoElement) {
  video.play().catch((error: { name?: string }) => {
    if (error.name === "NotAllowedError" && !video.muted) {
      video.muted = true;
      video.play().catch(() => undefined);
    }
  });
}
