/**
 * go2rtc MSE live stream over a WebSocket.
 *
 * Ported from the previous React MSEPlayer: codec negotiation, segment
 * buffering, back-buffer trimming, adaptive catch-up playback rate and stall
 * detection. Reconnects on unexpected closes.
 */
import { wsBaseUrl } from "@/api/baseUrl";
import { createVideoElement, LiveSession, playMuted } from "./session";

const CODECS = [
  "avc1.640029", // H.264 high 4.1
  "avc1.64002A", // H.264 high 4.2
  "avc1.640033", // H.264 high 5.1
  "hvc1.1.6.L153.B0", // H.265 main 5.1
  "mp4a.40.2", // AAC LC
  "mp4a.40.5", // AAC HE
  "flac",
  "opus",
];

const RECONNECT_TIMEOUT = 10_000;
const NEGOTIATE_TIMEOUT = 3_000;
const STALL_TIMEOUT = 3_000;
const MAX_BUFFER_ENTRIES = 10;
const JUMP_COOLDOWN = 5_000;
const MAX_ERRORS = 3;

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

type MediaSourceCtor = typeof MediaSource;

function mediaSourceCtor(): MediaSourceCtor | undefined {
  const w = window as unknown as { ManagedMediaSource?: MediaSourceCtor };
  return w.ManagedMediaSource ?? window.MediaSource;
}

export function supportsMse() {
  return mediaSourceCtor() !== undefined;
}

export class MseSession extends LiveSession {
  readonly element: HTMLVideoElement = createVideoElement();

  private ws: WebSocket | null = null;
  private ms: MediaSource | null = null;
  private sb: SourceBuffer | null = null;
  private buf = new Uint8Array(2 * 1024 * 1024);
  private bufLen = 0;
  private intentional = false;
  private connectedAt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private negotiateTimer: ReturnType<typeof setTimeout> | undefined;
  private stallTimer: ReturnType<typeof setTimeout> | undefined;
  private bufferTimes: number[] = [];
  private bufferIndex = 0;
  private lastJump = 0;
  private errorCount = 0;
  private parked = false;

  constructor(stream: string) {
    super("mse", stream);
    const video = this.element;
    video.addEventListener("loadeddata", () => {
      this.resolution.value = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
      this.lastJump = Date.now();
    });
    video.addEventListener("progress", () => this.onProgress());
    video.addEventListener("pause", () => {
      // live streams are not pausable unless deliberately parked
      if (!this.parked && this.status.value === "playing") playMuted(video);
    });
    video.addEventListener("error", () => this.onMediaError());
  }

  connect() {
    if (this.ws) return;
    this.intentional = false;
    this.status.value = "connecting";
    this.error.value = undefined;
    this.connectedAt = Date.now();

    const ws = new WebSocket(
      `${wsBaseUrl}live/mse/api/ws?src=${encodeURIComponent(this.stream)}`,
    );
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.addEventListener("open", () => this.onOpen(ws));
    ws.addEventListener("close", () => this.onClose(ws));
  }

  disconnect() {
    this.intentional = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.negotiateTimer);
    clearTimeout(this.stallTimer);
    const ws = this.ws;
    this.ws = null;
    this.sb = null;
    this.bufLen = 0;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      try {
        ws.close();
      } catch {
        // already closing
      }
    }
    if (this.status.value !== "error") this.status.value = "idle";
  }

  park() {
    this.parked = true;
    this.element.pause();
  }

  resume() {
    this.parked = false;
    this.jumpToLive();
    this.watchFirstFrame(this.element);
    playMuted(this.element);
  }

  setMuted(muted: boolean) {
    this.element.muted = muted;
  }

  setVolume(volume: number) {
    this.element.volume = volume;
  }

  private onOpen(ws: WebSocket) {
    if (ws !== this.ws) return;

    ws.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        this.onMessage(JSON.parse(event.data));
      } else {
        this.onData(event.data as ArrayBuffer);
      }
    });

    const Ctor = mediaSourceCtor();
    if (!Ctor) {
      this.fail("unsupported", "MediaSource is not available");
      return;
    }
    const ms = new Ctor();
    this.ms = ms;
    const managed = "ManagedMediaSource" in window;

    ms.addEventListener(
      "sourceopen",
      () => {
        if (ws !== this.ws || ws.readyState !== WebSocket.OPEN) return;
        if (!managed) URL.revokeObjectURL(this.element.src);
        const supported = CODECS.filter((codec) =>
          Ctor.isTypeSupported(`video/mp4; codecs="${codec}"`),
        ).join();
        ws.send(JSON.stringify({ type: "mse", value: supported }));
        this.negotiateTimer = setTimeout(() => {
          this.disconnect();
          this.fail(
            isSafari ? "mse-decode" : "startup",
            isSafari
              ? "Safari cannot open MediaSource."
              : "Error opening MediaSource.",
          );
        }, NEGOTIATE_TIMEOUT);
      },
      { once: true },
    );

    if (managed) {
      this.element.srcObject = ms as unknown as MediaProvider;
    } else {
      this.element.srcObject = null;
      this.element.src = URL.createObjectURL(ms);
    }

    this.watchFirstFrame(this.element);
    if (!this.parked) playMuted(this.element);
  }

  private onMessage(msg: { type: string; value: string }) {
    if (msg.type === "error" && msg.value?.includes("codecs not matched")) {
      this.disconnect();
      this.fail("mse-codec", msg.value);
      return;
    }
    if (msg.type !== "mse" || !this.ms) return;
    clearTimeout(this.negotiateTimer);

    let sb: SourceBuffer;
    try {
      sb = this.ms.addSourceBuffer(msg.value);
      sb.mode = "segments";
    } catch (error) {
      if (error instanceof DOMException && error.name === "InvalidStateError") {
        this.disconnect();
        this.fail("mse-decode", "Safari reported InvalidStateError.");
        return;
      }
      throw error;
    }
    this.sb = sb;

    sb.addEventListener("updateend", () => {
      if (sb.updating) return;
      try {
        if (this.bufLen > 0) {
          const data = this.buf.slice(0, this.bufLen);
          this.bufLen = 0;
          sb.appendBuffer(data);
          return;
        }
        // trim the back buffer, keeping 15 seconds for a parked resume
        if (sb.buffered.length) {
          const end = sb.buffered.end(sb.buffered.length - 1) - 15;
          const start = sb.buffered.start(0);
          if (end - start > 1) {
            sb.remove(start, end);
            this.ms?.setLiveSeekableRange(end, end + 15);
          }
        }
      } catch {
        // source buffer was detached
      }
    });
  }

  private onData(data: ArrayBuffer) {
    const sb = this.sb;
    if (!sb) return;
    if (sb.updating || this.bufLen > 0) {
      const bytes = new Uint8Array(data);
      if (this.bufLen + bytes.byteLength > this.buf.byteLength) {
        // the decoder is falling behind, drop the backlog rather than overflow
        this.bufLen = 0;
        return;
      }
      this.buf.set(bytes, this.bufLen);
      this.bufLen += bytes.byteLength;
    } else {
      try {
        sb.appendBuffer(data);
      } catch {
        // quota exceeded or detached
      }
    }
  }

  private onClose(ws: WebSocket) {
    if (ws !== this.ws) return;
    this.ws = null;
    if (this.intentional) return;
    const delay = Math.max(
      RECONNECT_TIMEOUT - (Date.now() - this.connectedAt),
      0,
    );
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private onMediaError() {
    const code = this.element.error?.code;
    if (!this.ws) return;
    this.errorCount++;
    this.disconnect();

    if (code === MediaError.MEDIA_ERR_NETWORK) {
      this.fail("startup", "Browser reported a network error.");
    } else if (code === MediaError.MEDIA_ERR_DECODE && isSafari) {
      this.fail("mse-decode", "Safari reported decoding errors.");
    } else if (this.errorCount >= MAX_ERRORS) {
      this.fail("startup", `Max error count ${this.errorCount} exceeded.`);
    } else {
      this.intentional = false;
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
  }

  private bufferedTime() {
    const video = this.element;
    if (!video.buffered.length) return 0;
    return video.buffered.end(video.buffered.length - 1) - video.currentTime;
  }

  private jumpToLive() {
    const buffered = this.element.buffered;
    if (buffered.length) {
      this.element.currentTime = buffered.end(buffered.length - 1) - 0.3;
      this.lastJump = Date.now();
    }
  }

  private onProgress() {
    if (this.parked) return;
    const video = this.element;
    const bufferTime = this.bufferedTime();

    if (video.playbackRate === 1 || bufferTime < 3) {
      if (this.bufferTimes.length < MAX_BUFFER_ENTRIES) {
        this.bufferTimes.push(bufferTime);
      } else {
        this.bufferTimes[this.bufferIndex] = bufferTime;
        this.bufferIndex = (this.bufferIndex + 1) % MAX_BUFFER_ENTRIES;
      }
    }

    const average =
      this.bufferTimes.reduce((a, b) => a + b, 0) /
      (this.bufferTimes.length || 1);
    const threshold = average * (isSafari ? 3 : 1.5);
    const playing = this.status.value === "playing";

    // buffered media but no frame yet usually means a codec quirk, mark it
    // playing so stall handling can take over
    if (!playing && bufferTime > 3) this.markPlaying();

    if (playing && (threshold > 10 || bufferTime > 10)) {
      this.disconnect();
      this.fail(
        "stalled",
        "Buffer time (10 seconds) exceeded, browser may not be playing media correctly.",
      );
      return;
    }

    if (playing) {
      if (isSafari) {
        if (bufferTime > 3 && Date.now() - this.lastJump > JUMP_COOLDOWN)
          this.jumpToLive();
      } else {
        const settled =
          ((bufferTime <= threshold && threshold < 3) || bufferTime < 3) &&
          this.bufferTimes.length <= MAX_BUFFER_ENTRIES;
        const rate = settled
          ? 1
          : Math.min(1 + 0.2 * Math.exp(0.5 * bufferTime - threshold), 2);
        if (video.playbackRate !== rate) video.playbackRate = rate;
      }
    }

    if (video.paused) return;
    clearTimeout(this.stallTimer);
    const timeout = bufferTime === 0 ? STALL_TIMEOUT * 2 : STALL_TIMEOUT;
    this.stallTimer = setTimeout(() => {
      if (document.visibilityState === "visible" && this.ws && !this.parked) {
        this.disconnect();
        this.fail(
          "stalled",
          `Media playback has stalled after ${timeout / 1000} seconds due to insufficient buffering or a network interruption.`,
        );
      }
    }, timeout);
  }
}
