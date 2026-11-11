/** Picks which go2rtc stream and transport a camera should play live. */
import type { CameraConfig, FrigateConfig } from "@/types/frigate";
import type { LiveMode } from "./session";
import { supportsMse } from "./mse";
import { supportsWebRtc } from "./webrtc";

export type StreamChoice = {
  /** go2rtc stream name, empty when the camera is not restreamed */
  stream: string;
  restreamed: boolean;
  /** transports to try in order */
  modes: LiveMode[];
};

/** Stream names exposed for a camera, in config order. */
export function cameraStreams(
  camera: CameraConfig,
): [label: string, stream: string][] {
  return Object.entries(camera.live?.streams ?? {});
}

/**
 * Choose a stream and the ordered fallback chain of transports.
 *
 * MSE first (lowest latency to start, plays everywhere with MediaSource),
 * WebRTC when MSE is missing or fails and candidates are configured, and
 * jsmpeg as the last resort that always works.
 */
export function chooseStream(
  camera: CameraConfig,
  config: FrigateConfig,
  options: { preferredStream?: string; lowBandwidth?: boolean } = {},
): StreamChoice {
  const streams = cameraStreams(camera).map(([, stream]) => stream);
  const stream =
    options.preferredStream && streams.includes(options.preferredStream)
      ? options.preferredStream
      : (streams[0] ?? "");
  const restreamed = !!stream && stream in (config.go2rtc?.streams ?? {});

  if (!restreamed || options.lowBandwidth) {
    return { stream, restreamed, modes: ["jsmpeg"] };
  }

  const modes: LiveMode[] = [];
  if (supportsMse()) modes.push("mse");
  if (
    supportsWebRtc() &&
    (!supportsMse() || (config.go2rtc.webrtc?.candidates?.length ?? 0) > 0)
  ) {
    modes.push("webrtc");
  }
  modes.push("jsmpeg");
  return { stream, restreamed, modes };
}
