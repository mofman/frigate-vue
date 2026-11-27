/** Pure helpers that turn setup wizard choices into config and validation. */
import type {
  DetectionHardware,
  HwaccelFamily,
  HwaccelRecommendation,
} from "@/types/hardware";

export type ConfigData = Record<string, unknown>;
export type CameraCodec = { camera: string; codec: string };
export type RecordingMode = "events" | "continuous";

export const HWACCEL_AUTO = "auto";
export const HWACCEL_NONE = "none";
export const RECORDINGS_PATH = "/media/frigate/recordings";
export const MIN_RETENTION_DAYS = 1;
export const MAX_RETENTION_DAYS = 365;
export const MIN_PASSWORD_LENGTH = 12;

/** these ship no default model, so they cannot start without one */
export const MODEL_REQUIRED_DETECTORS = ["onnx", "tensorrt"];

export const CPU_FALLBACK: DetectionHardware[] = [
  {
    key: "cpu",
    detector: "cpu",
    name: "CPU",
    units: [{ device: "cpu", label: "CPU" }],
    count: 1,
    unlimited: true,
  },
];

const ANY_CODEC = "any";
const CAMERAS_PER_DETECTOR = 8;
const MAX_DETECTORS = 8;
// a rough figure for one camera recording around the clock at 2 Mbps
const GB_PER_CAMERA_DAY = (2 / 8) * (86400 / 1024);

/** ffprobe names h265 streams hevc, the presets are keyed h265. */
export function normalizeCodec(codec: string): string {
  const lower = codec.toLowerCase();
  return lower === "hevc" ? "h265" : lower;
}

export function cameraCodecs(codecs: Record<string, string>): CameraCodec[] {
  return Object.entries(codecs).map(([camera, codec]) => ({
    camera,
    codec: normalizeCodec(codec),
  }));
}

/** Query for the hwaccel recommendation, leaving out what is not known yet. */
export function hwaccelParams(
  detector: string | undefined,
  cameras: CameraCodec[],
) {
  const codecs = [...new Set(cameras.map((entry) => entry.codec))];
  return {
    detector,
    codecs: codecs.length ? codecs.join(",") : undefined,
  };
}

function familyConfig(
  family: HwaccelFamily | undefined,
  cameras: CameraCodec[],
): ConfigData | null {
  if (!family) return null;

  const shared = family.presets[ANY_CODEC];
  if (shared) return { ffmpeg: { hwaccel_args: shared } };

  const perCamera = cameras.flatMap((entry) => {
    const preset = family.presets[entry.codec];
    return preset ? [{ camera: entry.camera, preset }] : [];
  });

  if (!perCamera.length) {
    const fallback = Object.values(family.presets)[0];
    return fallback ? { ffmpeg: { hwaccel_args: fallback } } : null;
  }

  const presets = new Set(perCamera.map((entry) => entry.preset));
  if (presets.size === 1 && perCamera.length === cameras.length) {
    return { ffmpeg: { hwaccel_args: perCamera[0].preset } };
  }

  // the global stays on auto so cameras added later resolve at startup
  // instead of inheriting one camera's codec
  return {
    cameras: Object.fromEntries(
      perCamera.map((entry) => [
        entry.camera,
        { ffmpeg: { hwaccel_args: entry.preset } },
      ]),
    ),
  };
}

/** The config for a hwaccel choice, or null when it writes nothing. */
export function hwaccelConfig(
  selected: string,
  recommendation: HwaccelRecommendation | undefined,
  cameras: CameraCodec[],
): ConfigData | null {
  // an empty string would make config/set delete the key, reviving "auto"
  if (selected === HWACCEL_NONE) return { ffmpeg: { hwaccel_args: [] } };
  const key =
    selected === HWACCEL_AUTO ? recommendation?.recommended : selected;
  const family = recommendation?.available.find((entry) => entry.key === key);
  return familyConfig(family, cameras);
}

/** One detector per eight cameras, without one process per camera. */
export function recommendedDetectorCount(cameraCount: number): number {
  const scaled = Math.ceil(cameraCount / CAMERAS_PER_DETECTOR);
  return Math.min(Math.max(scaled, 1), MAX_DETECTORS);
}

export function detectorDevices(
  hardware: DetectionHardware,
  cameraCount: number,
): string[] {
  const first = hardware.units[0]?.device;
  if (!first) return [];
  if (!hardware.unlimited) return [first];
  // repeating a device runs an extra inference process on it
  const count = recommendedDetectorCount(Math.max(cameraCount, 1));
  return Array.from({ length: count }, () => first);
}

export function detectorConfig(
  hardware: DetectionHardware,
  cameraCount: number,
  plusModelId?: string,
): ConfigData {
  const model: ConfigData = {
    devices: detectorDevices(hardware, cameraCount),
  };
  if (plusModelId) model.path = `plus://${plusModelId}`;
  return { models: [model], detect: { enabled: true } };
}

export function clampRetentionDays(value: string): number {
  const days = Number.parseInt(value, 10);
  if (!Number.isFinite(days)) return MIN_RETENTION_DAYS;
  return Math.min(Math.max(days, MIN_RETENTION_DAYS), MAX_RETENTION_DAYS);
}

export function recordingConfig(
  enabled: boolean,
  mode: RecordingMode,
  days: number,
): ConfigData {
  if (!enabled) return { record: { enabled } };
  return {
    record: {
      enabled,
      alerts: { retain: { days } },
      detections: { retain: { days } },
      // written even when off, so switching modes back turns it off again
      continuous: { days: mode === "continuous" ? days : 0 },
    },
  };
}

/** Whole days of continuous recording that fit, from free space in MiB. */
export function recordingStorageEstimate(freeMb: number, cameras: number) {
  if (cameras <= 0 || freeMb <= 0) return null;
  const free = Math.round(freeMb / 1024);
  return {
    free,
    days: Math.round(free / GB_PER_CAMERA_DAY / cameras),
  };
}

/** Returns a views/settings translation key, or "" when valid. */
export function usernameError(username: string): string {
  if (!username) return "users.dialog.form.usernameIsRequired";
  if (!/^[A-Za-z0-9._]+$/.test(username)) {
    return "users.dialog.createUser.usernameOnlyInclude";
  }
  if (!/[^.]/.test(username)) return "users.dialog.createUser.usernameOnlyDots";
  return "";
}

/** Returns a views/settings translation key, or "" when valid. */
export function passwordError(password: string): string {
  return password.length < MIN_PASSWORD_LENGTH
    ? "users.dialog.form.password.requirements.length"
    : "";
}

/** Returns a views/settings translation key, or "" when valid. */
export function confirmPasswordError(
  password: string,
  confirm: string,
): string {
  if (!confirm) return "users.dialog.createUser.confirmPassword";
  return password === confirm ? "" : "users.dialog.form.password.notMatch";
}
