/** Pure Add Camera wizard logic: names, stream urls and the saved config. */
import {
  CAMERA_BRANDS,
  type CameraBrand,
  type FfprobeEntry,
  type Go2rtcStreamInfo,
  type ReolinkProtocol,
  type StreamConfig,
  type StreamRole,
  type TestResult,
  type WizardData,
} from "@/types/cameraWizard";

const DETECT_TARGET_PX = 720;
const HEVC_CODECS = ["hevc", "h265"];

/** Recording the same stream twice would just duplicate the main stream. */
const CONFLICTING_ROLES: Partial<Record<StreamRole, StreamRole>> = {
  record: "record_sub",
  record_sub: "record",
};

function isValidId(name: string) {
  return /^[a-zA-Z0-9_-]+$/.test(name) && !/^\d+$/.test(name);
}

/** FNV-1a, so names in any script give a stable Latin identifier. */
function fixedHash(name: string, prefix: string) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(name)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `${prefix}_${/^[0-9]/.test(hex) ? `a${hex.slice(1)}` : hex}`;
}

export function processCameraName(input: string): {
  name: string;
  friendlyName?: string;
} {
  const normalized = input.replace(/\s+/g, "_").toLowerCase();
  if (isValidId(normalized)) {
    return {
      name: normalized,
      friendlyName: input.includes(" ") ? input : undefined,
    };
  }
  return { name: fixedHash(input, "cam"), friendlyName: input };
}

export type NameStepForm = {
  cameraName: string;
  host: string;
  probeMode: boolean;
  brand: CameraBrand;
  customUrl: string;
  onvifPort: string;
};

export type NameStepErrors = Partial<
  Record<"cameraName" | "customUrl" | "onvifPort", string>
>;

/** Returns views/settings translation keys for the invalid fields. */
export function validateNameStep(
  form: NameStepForm,
  existingCameras: string[],
): NameStepErrors {
  const errors: NameStepErrors = {};
  const name = form.cameraName.trim();
  const prefix = "cameraWizard.step1.errors";
  if (!name) errors.cameraName = `${prefix}.nameRequired`;
  else if (name.length > 64) errors.cameraName = `${prefix}.nameLength`;
  else if (
    existingCameras.includes(name) ||
    existingCameras.includes(processCameraName(name).name)
  ) {
    errors.cameraName = `${prefix}.nameExists`;
  }

  if (form.probeMode) {
    const port = Number(form.onvifPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.onvifPort = `${prefix}.onvifPortInvalid`;
    }
  } else if (form.brand === "other") {
    const url = form.customUrl.trim();
    if (!url) errors.customUrl = `${prefix}.brandOrCustomUrlRequired`;
    else if (!/^rtsps?:\/\//.test(url)) {
      errors.customUrl = `${prefix}.customUrlRtspRequired`;
    }
  }
  return errors;
}

export function canContinueNameStep(form: NameStepForm) {
  if (!form.cameraName.trim()) return false;
  return !form.probeMode && form.brand === "other"
    ? !!form.customUrl.trim()
    : !!form.host.trim();
}

export function isOnvifInvalid(onvif: WizardData["onvif"]) {
  return !!onvif?.enabled && (!onvif.host.trim() || !onvif.port);
}

/** Whether a 0 based wizard step has what the next one needs. */
export function canLeaveStep(step: number, data: WizardData) {
  switch (step) {
    case 0:
      return !!data.cameraName;
    case 1:
      return data.streams.length > 0;
    case 2:
      return (
        data.streams.some((stream) => stream.roles.includes("detect")) &&
        !isOnvifInvalid(data.onvif)
      );
    default:
      return true;
  }
}

/** Hide credentials in a stream url shown on screen. */
export function maskUri(uri: string): string {
  const userInfo = uri.match(/^([a-z][a-z0-9+.-]*):\/\/([^:/@]+):(.+)@(.+)$/i);
  if (userInfo) {
    return `${userInfo[1]}://${userInfo[2]}:****@${userInfo[4]}`;
  }
  try {
    const url = new URL(uri);
    if (url.searchParams.has("password")) {
      url.searchParams.set("password", "****");
      return url.toString();
    }
  } catch {
    // not a url, nothing to mask
  }
  return uri;
}

function fillTemplate(template: string, data: WizardData) {
  // replacer functions, since a password may contain "$&" style patterns
  return template
    .replace("{username}", () => data.username ?? "")
    .replace("{password}", () => data.password ?? "")
    .replace("{host}", () => data.host ?? "");
}

/** Stream urls to try for a manually selected brand, best first. */
export function brandStreamUrls(
  data: WizardData,
  reolinkProtocol?: ReolinkProtocol | null,
): string[] {
  if (data.brandTemplate === "other") {
    return data.customUrl ? [data.customUrl] : [];
  }
  const brand = CAMERA_BRANDS.find((b) => b.value === data.brandTemplate);
  if (!brand || !data.host) return [];
  if (!("dynamicTemplates" in brand))
    return [fillTemplate(brand.template, data)];

  // only some Reolink cameras above 5MP serve http-flv, so RTSP is the
  // fallback when the http-flv stream does not probe
  const protocols: ReolinkProtocol[] =
    reolinkProtocol === "rtsp"
      ? ["http-flv", "rtsp"]
      : [reolinkProtocol ?? "rtsp"];
  return protocols.map((protocol) =>
    fillTemplate(brand.dynamicTemplates[protocol], data),
  );
}

/** Parse one entry of the ffprobe API response. */
export function ffprobeToTestResult(
  entry: FfprobeEntry | undefined,
): TestResult {
  if (!entry || entry.return_code !== 0) {
    const stderr = entry?.stderr;
    const text = Array.isArray(stderr) ? stderr.join("\n") : stderr;
    return { success: false, error: text?.trim() || undefined };
  }

  let stdout = entry.stdout;
  if (typeof stdout === "string") {
    try {
      stdout = JSON.parse(stdout) as { streams?: [] };
    } catch {
      stdout = {};
    }
  }
  const streams = (typeof stdout === "object" && stdout.streams) || [];
  const video = streams.find(
    (s) =>
      s.codec_type === "video" ||
      s.codec_name?.includes("h264") ||
      s.codec_name?.includes("h265") ||
      s.codec_name?.includes("hevc"),
  );
  const audio = streams.find(
    (s) =>
      s.codec_type === "audio" ||
      ["aac", "mp3", "pcm_mulaw", "pcm_alaw"].some((codec) =>
        s.codec_name?.includes(codec),
      ),
  );

  const width = Number(video?.width ?? 0);
  const height = Number(video?.height ?? 0);
  const [frames, seconds] = (video?.avg_frame_rate ?? "")
    .split("/")
    .map(Number);
  const fps = frames / seconds;

  return {
    success: true,
    resolution: width > 0 && height > 0 ? `${width}x${height}` : undefined,
    videoCodec: video?.codec_name,
    audioCodec: audio?.codec_name,
    fps:
      Number.isFinite(fps) && fps > 0 ? Math.round(fps * 100) / 100 : undefined,
  };
}

export function testSummary(result: TestResult, fpsLabel: string) {
  return [
    result.resolution,
    result.fps ? `${result.fps} ${fpsLabel}` : undefined,
    result.videoCodec,
    result.audioCodec,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Scale to an efficient detect size, keeping the aspect and never upscaling. */
export function calculateDetectDimensions(
  streamWidth: number,
  streamHeight: number,
): { width: number; height: number } | null {
  if (!(streamWidth > 0) || !(streamHeight > 0)) return null;
  if (!Number.isFinite(streamWidth) || !Number.isFinite(streamHeight)) {
    return null;
  }
  const smaller = Math.min(streamWidth, streamHeight);
  const scale = Math.min(DETECT_TARGET_PX, smaller) / smaller;
  // video processing requires even dimensions
  const width = Math.round(streamWidth * scale);
  const height = Math.round(streamHeight * scale);
  const even = { width: width - (width % 2), height: height - (height % 2) };
  return even.width >= 2 && even.height >= 2 ? even : null;
}

/** First recording stream probed as H.265, which Apple devices need tagged. */
export function hevcRecordingStreamId(streams: StreamConfig[]) {
  return streams.find(
    (stream) =>
      (stream.roles.includes("record") ||
        stream.roles.includes("record_sub")) &&
      HEVC_CODECS.includes(
        (stream.testResult?.videoCodec ?? "").trim().toLowerCase(),
      ),
  )?.id;
}

export function isRoleBlocked(
  stream: StreamConfig,
  role: StreamRole,
  streams: StreamConfig[],
) {
  if (stream.roles.includes(role)) return false;
  const usedElsewhere = streams.some(
    (other) => other.id !== stream.id && other.roles.includes(role),
  );
  const conflict = CONFLICTING_ROLES[role];
  return usedElsewhere || (!!conflict && stream.roles.includes(conflict));
}

export function hasTwoWayAudio(info: Go2rtcStreamInfo | undefined) {
  return !!info?.producers?.some((producer) =>
    producer.medias?.some((media) => media.includes("audio, sendonly")),
  );
}

export function go2rtcStreamName(camera: string, index: number, count: number) {
  return count === 1 ? camera : `${camera}_${index + 1}`;
}

/** The config/set body that adds the camera. */
export function buildCameraConfig(data: WizardData) {
  const { name, friendlyName } = processCameraName(data.cameraName ?? "");
  const { streams, onvif } = data;
  const streamName = (index: number) =>
    go2rtcStreamName(name, index, streams.length);

  const camera: Record<string, unknown> = {
    enabled: true,
    ...(friendlyName && { friendly_name: friendlyName }),
    ffmpeg: {
      // re-checked here: roles and codecs may have changed since it was set
      ...(data.appleCompatibility &&
        hevcRecordingStreamId(streams) && { apple_compatibility: true }),
      inputs: streams.map((stream, index) =>
        stream.restream
          ? {
              path: `rtsp://127.0.0.1:8554/${streamName(index)}`,
              input_args: "preset-rtsp-restream",
              roles: stream.roles,
            }
          : { path: stream.url, roles: stream.roles },
      ),
    },
    live: {
      streams: Object.fromEntries(
        streams.map((_, index) => [`Stream ${index + 1}`, streamName(index)]),
      ),
    },
  };

  const resolution = streams.find((stream) => stream.roles.includes("detect"))
    ?.testResult?.resolution;
  if (resolution) {
    const [width, height] = resolution.split("x").map(Number);
    const detect = calculateDetectDimensions(width, height);
    if (detect) camera.detect = detect;
  }

  if (onvif?.enabled && onvif.host.trim()) {
    camera.onvif = {
      host: onvif.host.trim(),
      port: onvif.port,
      ...(onvif.user?.trim() && { user: onvif.user.trim() }),
      ...(onvif.password && { password: onvif.password }),
    };
  }

  return {
    name,
    friendlyName,
    body: {
      requires_restart: 1,
      config_data: { cameras: { [name]: camera } },
      update_topic: `config/cameras/${name}/add`,
    },
  };
}

/** go2rtc sources for each stream of the camera. */
export function buildGo2rtcStreams(
  camera: string,
  streams: StreamConfig[],
  hasBackchannel: boolean,
): Record<string, string[]> {
  return Object.fromEntries(
    streams.map((stream, index) => {
      const url = stream.useFfmpeg ? `ffmpeg:${stream.url}` : stream.url;
      return [
        go2rtcStreamName(camera, index, streams.length),
        // the first source avoids taking the microphone on every connection
        hasBackchannel ? [`${url}#backchannel=0`, url] : [url],
      ];
    }),
  );
}
