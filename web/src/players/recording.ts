/**
 * Recorded playback through Frigate's VOD HLS endpoint.
 *
 * The player owns one video element for its lifetime. Sources are only
 * rebuilt when a seek leaves the loaded window, never on a timer, so watching
 * recent footage doesn't periodically tear down hls.js.
 */
import Hls from "hls.js";
import { shallowRef } from "vue";
import { baseUrl } from "@/api/baseUrl";
import { http, HttpError } from "@/api/http";
import type { RecordingCoverage, RecordingSpan } from "@/types/frigate";
import {
  inpointOffset,
  nextRecorded,
  seekPosition,
  timestampAt,
  vodWindow,
} from "./vod";
import { playMuted } from "./session";

export type RecordingSource = {
  camera: string;
  after: number;
  before: number;
  spans: RecordingSpan[];
  offset: number;
  playlist: string;
};

export type RecordingStatus = "idle" | "loading" | "ready" | "empty" | "error";

const BUFFERING_DEBOUNCE = 250;

// servers before the coverage endpoint 404 on it; remember that so every
// seek doesn't pay for a failed request first
let coverageSupported = true;

/** Plain recording segments, available on every Frigate version. */
async function fetchRecordingSegments(
  camera: string,
  after: number,
  before: number,
): Promise<RecordingSpan[]> {
  const recordings = await http.get<RecordingSpan[]>(`${camera}/recordings`, {
    params: { after, before },
  });
  return [...recordings].sort((a, b) => a.start_time - b.start_time);
}

async function fetchSpans(
  camera: string,
  after: number,
  before: number,
): Promise<RecordingSpan[]> {
  if (coverageSupported) {
    try {
      const coverage = await http.get<RecordingCoverage>(
        `${camera}/recordings/coverage`,
        { params: { after, before, timelines: true } },
      );
      const timeline = coverage.timelines?.auto;
      if (timeline) {
        return timeline.map((span) => ({
          start_time: span.start_time,
          end_time: span.end_time,
          duration: span.duration / 1000,
        }));
      }
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 404) throw error;
      coverageSupported = false;
    }
  }
  return fetchRecordingSegments(camera, after, before);
}

export class RecordingPlayer {
  readonly video: HTMLVideoElement;
  readonly status = shallowRef<RecordingStatus>("idle");
  readonly buffering = shallowRef(false);
  /** wall clock time of the current frame */
  readonly timestamp = shallowRef<number | undefined>();
  readonly firstFrameAt = shallowRef(0);
  readonly playing = shallowRef(false);
  source: RecordingSource | undefined;

  onEnded: (() => void) | undefined;

  private hls: Hls | undefined;
  private bufferingTimer: ReturnType<typeof setTimeout> | undefined;
  private loadToken = 0;
  private pendingSeek: { position: number; play: boolean } | undefined;
  private started = false;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    video.playsInline = true;
    video.preload = "auto";
    video.muted = true;

    video.addEventListener("timeupdate", () => {
      this.setBuffering(false);
      if (!this.source) return;
      const ts = timestampAt(
        video.currentTime,
        this.source.spans,
        this.source.offset,
      );
      if (ts !== undefined) this.timestamp.value = ts;
    });
    video.addEventListener("waiting", () => this.setBuffering(true));
    video.addEventListener("playing", () => {
      this.setBuffering(false);
      this.playing.value = true;
    });
    video.addEventListener("pause", () => (this.playing.value = false));
    video.addEventListener("seeked", () => this.setBuffering(false));
    video.addEventListener("ended", () => this.onEnded?.());
    video.addEventListener("loadedmetadata", () => this.applyPendingSeek());
  }

  /** Is the timestamp inside the loaded window for this camera? */
  covers(camera: string, timestamp: number) {
    const source = this.source;
    return (
      !!source &&
      source.camera === camera &&
      timestamp >= source.after &&
      timestamp <= source.before
    );
  }

  /** Latest recorded instant in the loaded window. */
  get recordedUntil() {
    return this.source?.spans.at(-1)?.end_time;
  }

  /**
   * Make sure a playlist covering the timestamp is attached.
   *
   * With `load: false` the manifest is attached but no media is fetched,
   * which is how the stage pre-warms recordings while showing live.
   */
  async prepare(
    camera: string,
    timestamp: number,
    { load = true, play = false } = {},
  ) {
    if (this.covers(camera, timestamp)) {
      if (load) this.seek(timestamp, play);
      return;
    }

    const token = ++this.loadToken;
    this.status.value = "loading";
    const { after, before } = vodWindow(timestamp, Date.now() / 1000);

    let spans: RecordingSpan[];
    try {
      spans = await fetchSpans(camera, after, before);
    } catch {
      if (token === this.loadToken) this.status.value = "error";
      return;
    }
    if (token !== this.loadToken) return;

    if (!spans.length) {
      this.source = undefined;
      this.status.value = "empty";
      return;
    }

    this.source = {
      camera,
      after,
      before,
      spans,
      offset: inpointOffset(after, spans[0]),
      playlist: `${baseUrl}vod/${camera}/start/${after}/end/${before}/master.m3u8`,
    };
    this.attach(this.source, timestamp, load, play);
  }

  /** Seek within the loaded window. Returns false when outside it. */
  seek(timestamp: number, play = false) {
    const source = this.source;
    if (!source) return false;
    const target = nextRecorded(timestamp, source.spans) ?? timestamp;
    const position = seekPosition(target, source.spans, source.offset);
    if (position === undefined) return false;

    if (!this.started) {
      this.startLoading(position);
    }

    if (this.video.readyState < HTMLMediaElement.HAVE_METADATA) {
      this.pendingSeek = { position, play };
      return true;
    }

    this.timestamp.value = target;
    this.presentAt(position, play);
    return true;
  }

  play() {
    if (!this.started && this.timestamp.value !== undefined)
      this.seek(this.timestamp.value, true);
    else playMuted(this.video);
  }

  pause() {
    this.video.pause();
  }

  setMuted(muted: boolean) {
    this.video.muted = muted;
  }

  setRate(rate: number) {
    this.video.playbackRate = rate;
  }

  destroy() {
    this.loadToken++;
    clearTimeout(this.bufferingTimer);
    this.hls?.destroy();
    this.hls = undefined;
    this.video.removeAttribute("src");
    this.video.load();
  }

  private attach(
    source: RecordingSource,
    timestamp: number,
    load: boolean,
    play: boolean,
  ) {
    const position =
      seekPosition(
        nextRecorded(timestamp, source.spans) ?? timestamp,
        source.spans,
        source.offset,
      ) ?? 0;
    this.started = false;
    this.pendingSeek = { position, play };
    this.timestamp.value = timestamp;

    if (Hls.isSupported()) {
      if (!this.hls) {
        this.hls = new Hls({
          autoStartLoad: false,
          maxBufferLength: 30,
          backBufferLength: 60,
          maxBufferSize: 40 * 1000 * 1000,
          enableWorker: true,
        });
        this.hls.attachMedia(this.video);
        this.hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR)
            this.hls?.recoverMediaError();
          else this.status.value = "error";
        });
        this.hls.on(Hls.Events.FRAG_BUFFERED, () => {
          if (this.status.value === "loading") this.status.value = "ready";
        });
      }
      this.hls.stopLoad();
      this.hls.loadSource(source.playlist);
    } else {
      // Safari without MSE plays HLS natively
      this.video.src = source.playlist;
    }

    if (load) this.startLoading(position);
    else this.status.value = "ready";
  }

  private startLoading(position: number) {
    this.started = true;
    this.hls?.startLoad(position);
  }

  /**
   * Move to a playlist position and only report a frame once that position
   * is decoded. Reporting the first decoded frame of the playlist instead
   * would reveal the wrong moment for a beat before the seek lands.
   */
  private presentAt(position: number, play: boolean) {
    const video = this.video;
    if (Math.abs(video.currentTime - position) > 0.05) {
      video.currentTime = position;
      video.addEventListener("seeked", () => this.signalFrame(), {
        once: true,
      });
    } else {
      this.signalFrame();
    }
    if (play) playMuted(video);
    else video.pause();
  }

  /** Bump firstFrameAt once the current position is actually painted. */
  private signalFrame() {
    const video = this.video;
    const done = () => (this.firstFrameAt.value = performance.now());
    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      video.seeking
    ) {
      video.addEventListener("canplay", () => this.signalFrame(), {
        once: true,
      });
      return;
    }
    const withFrames = video as HTMLVideoElement & {
      requestVideoFrameCallback?: (callback: () => void) => number;
    };
    if (
      typeof withFrames.requestVideoFrameCallback === "function" &&
      !video.paused
    ) {
      withFrames.requestVideoFrameCallback(done);
    } else {
      // a paused element has already presented the seeked frame
      requestAnimationFrame(done);
    }
  }

  private applyPendingSeek() {
    const pending = this.pendingSeek;
    if (!pending) return;
    this.pendingSeek = undefined;
    this.presentAt(pending.position, pending.play);
  }

  private setBuffering(value: boolean) {
    clearTimeout(this.bufferingTimer);
    if (!value) {
      this.buffering.value = false;
      return;
    }
    this.bufferingTimer = setTimeout(
      () => (this.buffering.value = true),
      BUFFERING_DEBOUNCE,
    );
  }
}
