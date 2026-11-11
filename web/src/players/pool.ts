/**
 * Refcounted pool of live stream sessions.
 *
 * Leasing a stream that is already open returns the same session, so a
 * dashboard tile handing over to the camera stage, or the stage returning to
 * live after a short look at a recording, reuses an established connection
 * instead of renegotiating. Released sessions are parked and kept for a
 * linger window before being torn down.
 */
import { JsmpegSession } from "./jsmpeg";
import { MseSession } from "./mse";
import type { LiveMode, LiveSession } from "./session";
import { WebRtcSession } from "./webrtc";

export const DEFAULT_LINGER_MS = 15_000;

type Entry = {
  session: LiveSession;
  refs: number;
  destroyTimer?: ReturnType<typeof setTimeout>;
  background: boolean;
};

export type LeaseRequest = {
  mode: LiveMode;
  /** go2rtc stream name for mse/webrtc */
  stream: string;
  /** camera name, used by jsmpeg */
  camera: string;
  iceServers?: RTCIceServer[];
  /** keep streaming while the tab is hidden */
  background?: boolean;
  /** webrtc only: also send the microphone (two way talk) */
  talk?: boolean;
};

export type Lease = {
  session: LiveSession;
  release: (lingerMs?: number) => void;
};

const entries = new Map<string, Entry>();

function keyFor({ mode, stream, camera, talk }: LeaseRequest) {
  if (mode === "jsmpeg") return `jsmpeg:${camera}`;
  // a talking session holds the microphone, never share it with tiles
  return mode === "webrtc" && talk
    ? `webrtc-talk:${stream}`
    : `${mode}:${stream}`;
}

function create(request: LeaseRequest): LiveSession {
  switch (request.mode) {
    case "mse":
      return new MseSession(request.stream);
    case "webrtc":
      return new WebRtcSession(
        request.stream,
        request.iceServers,
        !!request.talk,
      );
    case "jsmpeg":
      return new JsmpegSession(request.camera);
  }
}

function destroy(key: string, entry: Entry) {
  clearTimeout(entry.destroyTimer);
  entry.session.destroy();
  entries.delete(key);
}

export function leaseLive(request: LeaseRequest): Lease {
  const key = keyFor(request);
  let entry = entries.get(key);

  // an errored session is useless to the next consumer, start fresh
  if (entry && entry.session.status.value === "error") {
    destroy(key, entry);
    entry = undefined;
  }

  if (!entry) {
    entry = {
      session: create(request),
      refs: 0,
      background: !!request.background,
    };
    entries.set(key, entry);
    if (document.visibilityState === "visible" || entry.background) {
      entry.session.connect();
    }
  }

  clearTimeout(entry.destroyTimer);
  entry.destroyTimer = undefined;
  entry.refs++;
  entry.background ||= !!request.background;

  const current = entry;
  let released = false;

  return {
    session: current.session,
    release: (lingerMs = DEFAULT_LINGER_MS) => {
      if (released) return;
      released = true;
      current.refs--;
      if (current.refs > 0) return;

      if (lingerMs <= 0 || current.session.status.value === "error") {
        destroy(key, current);
        return;
      }
      // a component swap releases and re-leases in the same flush; parking
      // only once that settles avoids a pause and resume on every handoff
      queueMicrotask(() => {
        if (current.refs > 0 || entries.get(key) !== current) return;
        current.session.park();
        current.destroyTimer = setTimeout(
          () => destroy(key, current),
          lingerMs,
        );
      });
    },
  };
}

/** Is a session for this stream already open (for instant handoffs)? */
export function isWarm(request: LeaseRequest) {
  return entries.get(keyFor(request))?.session.status.value === "playing";
}

// Hidden tabs drop their streams unless a consumer asked for background
// play, then reconnect on return. Parked sessions with no consumers are
// destroyed outright since nobody is waiting for them.
document.addEventListener("visibilitychange", () => {
  const visible = document.visibilityState === "visible";
  for (const [key, entry] of entries) {
    if (entry.background) continue;
    if (!visible) {
      if (entry.refs === 0) destroy(key, entry);
      else entry.session.disconnect();
    } else if (entry.refs > 0) {
      entry.session.connect();
    }
  }
});

export const __pool = { entries };
