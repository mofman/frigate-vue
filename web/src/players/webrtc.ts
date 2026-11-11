/** go2rtc WebRTC live stream, signaled over a WebSocket. */
import { wsBaseUrl } from "@/api/baseUrl";
import { createVideoElement, LiveSession, playMuted } from "./session";

const DEFAULT_ICE: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const STALL_TIMEOUT = 6_000;

export function supportsWebRtc() {
  return "RTCPeerConnection" in window;
}

export class WebRtcSession extends LiveSession {
  readonly element: HTMLVideoElement = createVideoElement();

  private pc: RTCPeerConnection | undefined;
  private ws: WebSocket | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | undefined;
  private lastTime = 0;

  constructor(
    stream: string,
    private iceServers: RTCIceServer[] = DEFAULT_ICE,
  ) {
    super("webrtc", stream);
    const video = this.element;
    video.addEventListener("loadeddata", () => {
      this.resolution.value = {
        width: video.videoWidth,
        height: video.videoHeight,
      };
    });
    video.addEventListener("timeupdate", () => this.armStallTimer());
  }

  connect() {
    if (this.pc) return;
    this.status.value = "connecting";
    this.error.value = undefined;

    const pc = new RTCPeerConnection({
      bundlePolicy: "max-bundle",
      iceServers: this.iceServers,
    });
    this.pc = pc;
    const tracks = ["video", "audio"].map(
      (kind) =>
        pc.addTransceiver(kind, { direction: "recvonly" }).receiver.track,
    );
    this.element.srcObject = new MediaStream(tracks);
    this.watchFirstFrame(this.element);
    playMuted(this.element);

    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed") {
        this.disconnect();
        this.fail("startup", "Peer connection failed.");
      }
    });

    const ws = new WebSocket(
      `${wsBaseUrl}live/webrtc/api/ws?src=${encodeURIComponent(this.stream)}`,
    );
    this.ws = ws;

    ws.addEventListener("open", () => {
      pc.addEventListener("icecandidate", (event) => {
        if (!event.candidate) return;
        ws.send(
          JSON.stringify({
            type: "webrtc/candidate",
            value: event.candidate.candidate,
          }),
        );
      });
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          ws.send(
            JSON.stringify({
              type: "webrtc/offer",
              value: pc.localDescription?.sdp,
            }),
          );
        })
        .catch(() => this.fail("startup", "Could not create a WebRTC offer."));
    });

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "webrtc/candidate") {
        void pc.addIceCandidate({ candidate: msg.value, sdpMid: "0" });
      } else if (msg.type === "webrtc/answer") {
        void pc.setRemoteDescription({ type: "answer", sdp: msg.value });
      } else if (msg.type === "error") {
        this.disconnect();
        this.fail("startup", String(msg.value));
      }
    });
  }

  disconnect() {
    clearTimeout(this.stallTimer);
    this.ws?.close();
    this.ws = null;
    this.pc?.close();
    this.pc = undefined;
    if (this.status.value !== "error") this.status.value = "idle";
  }

  park() {
    clearTimeout(this.stallTimer);
    this.element.pause();
  }

  resume() {
    this.watchFirstFrame(this.element);
    playMuted(this.element);
  }

  setMuted(muted: boolean) {
    this.element.muted = muted;
  }

  setVolume(volume: number) {
    this.element.volume = volume;
  }

  private armStallTimer() {
    if (this.element.currentTime === this.lastTime) return;
    this.lastTime = this.element.currentTime;
    clearTimeout(this.stallTimer);
    this.stallTimer = setTimeout(() => {
      if (
        document.visibilityState === "visible" &&
        !this.element.paused &&
        this.pc
      ) {
        this.disconnect();
        this.fail("stalled", "WebRTC playback stalled.");
      }
    }, STALL_TIMEOUT);
  }
}

export function iceServersFromConfig(
  configured:
    | { urls: string | string[]; username?: string; credential?: string }[]
    | undefined,
): RTCIceServer[] {
  if (!configured?.length) return DEFAULT_ICE;
  return configured.map(({ urls, username, credential }) => ({
    urls,
    username,
    credential,
  }));
}
