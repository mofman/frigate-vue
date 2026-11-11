/**
 * Rules behind the Health tab's hardware pane: is each detection model, each
 * hwaccel preset and each enrichment running where the config asks, and how
 * do the cameras connect. Pure functions; `t` only fills in text.
 */
import type {
  CameraConfig,
  DetectionModelConfig,
  FrigateConfig,
} from "@/types/frigate";
import type {
  DetectionHardware,
  HardwareRow,
  HwaccelRecommendation,
} from "@/types/health";
import {
  EmbeddingThreshold,
  InferenceThreshold,
  type ConnectionQuality,
  type FrigateStats,
  type GpuVendor,
} from "@/types/stats";

export type Translate = (
  key: string,
  options?: Record<string, unknown>,
) => string;

/** seconds after startup during which stats based rules report unknown */
export const STARTUP_WINDOW_S = 120;

const REPLAY_CAMERA_PREFIX = "_replay_";
const DEFAULT_SCENE = "default";

export function activeCameras(config: FrigateConfig): CameraConfig[] {
  return Object.values(config.cameras)
    .filter(
      (camera) =>
        camera.enabled && !camera.name.startsWith(REPLAY_CAMERA_PREFIX),
    )
    .sort((a, b) => a.ui.order - b.ui.order);
}

export function isStartupWindow(stats: FrigateStats | undefined): boolean {
  return !!stats && stats.service.uptime < STARTUP_WINDOW_S;
}

function sceneLabel(t: Translate, scene: string | undefined) {
  return !scene || scene === DEFAULT_SCENE
    ? t("views/settings:detectionModels.scenes.default")
    : scene;
}

// ---------------------------------------------------------------- detection

/**
 * Detector runner names exactly as the backend's runner_names() builds them:
 * every model's devices in config order, first occurrence is the raw device
 * string, the Nth repeat is "raw#N".
 */
export function runnerNames(models: DetectionModelConfig[]): string[] {
  const counts = new Map<string, number>();
  const names: string[] = [];
  for (const model of models) {
    for (const raw of model.devices) {
      const count = (counts.get(raw) ?? 0) + 1;
      counts.set(raw, count);
      names.push(count === 1 ? raw : `${raw}#${count}`);
    }
  }
  return names;
}

/** detectors the probe reports; anything else cannot be checked for presence */
const PROBED_DETECTORS = new Set([
  "cpu",
  "edgetpu",
  "hailo",
  "memryx",
  "openvino",
  "onnx",
  "tensorrt",
  "rknn",
  "axengine",
  "synaptics",
]);

/** detectors that fall back to the CPU when no accelerator is present */
const CPU_FALLBACK_DETECTORS = new Set(["onnx", "openvino"]);

export type DevicePresence = "present" | "unverified" | "absent";

/**
 * Whether a configured device string was found by the hardware probe.
 * "unverified" means the detector's hardware is present but the probe does
 * not enumerate this device (openvino:AUTO, rknn:0), so it is not missing.
 */
export function devicePresence(
  device: string,
  hardware: DetectionHardware[],
): DevicePresence {
  const [detector, ...rest] = device.split(":");
  const devicePart = rest.join(":");

  if (detector === "cpu" || devicePart.toUpperCase() === "CPU")
    return "present";
  if (!PROBED_DETECTORS.has(detector)) return "unverified";

  const entries = hardware.filter((entry) => entry.detector === detector);
  const generic = devicePart === "" || devicePart.toUpperCase() === "AUTO";

  if (entries.length === 0) {
    // a bare onnx or openvino runs on the CPU when nothing is attached
    return generic && CPU_FALLBACK_DETECTORS.has(detector)
      ? "unverified"
      : "absent";
  }
  if (generic) return "present";

  const unitMatch = entries.some((entry) =>
    entry.units.some(
      (unit) =>
        unit.device === device ||
        unit.device.startsWith(`${device}:`) ||
        unit.device.startsWith(`${device}.`),
    ),
  );
  return unitMatch ? "present" : "unverified";
}

function unitFor(entry: DetectionHardware, device: string) {
  return entry.units.some(
    (unit) =>
      unit.device === device ||
      unit.device.startsWith(`${device}:`) ||
      unit.device.startsWith(`${device}.`),
  );
}

/** Short summary of the hardware a model runs on, eg "Coral USB (2)". */
export function summarizeDevices(
  hardware: DetectionHardware[],
  devices: string[],
): string | undefined {
  if (devices.length === 0) return undefined;
  const known = hardware.find((entry) =>
    devices.every((device) => unitFor(entry, device)),
  );
  if (known) {
    return devices.length > 1
      ? `${known.name} (${devices.length})`
      : known.name;
  }
  const counts = new Map<string, number>();
  devices.forEach((device) =>
    counts.set(device, (counts.get(device) ?? 0) + 1),
  );
  return [...counts.entries()]
    .map(([device, count]) => (count > 1 ? `${device} (${count})` : device))
    .join(", ");
}

type DetectionArgs = {
  models: DetectionModelConfig[];
  hardware: DetectionHardware[] | undefined;
  probeFailed: boolean;
  stats: FrigateStats | undefined;
  startup: boolean;
  t: Translate;
};

export function detectionRows({
  models,
  hardware,
  probeFailed,
  stats,
  startup,
  t,
}: DetectionArgs): HardwareRow[] {
  const names = runnerNames(models);
  let cursor = 0;

  return models.map((model, index): HardwareRow => {
    const runners = names.slice(cursor, cursor + model.devices.length);
    cursor += model.devices.length;

    const label = sceneLabel(t, model.scene);
    const id = `detection:${index}`;
    const detail = probeFailed
      ? t("views/system:health.hardware.probeUnavailable")
      : summarizeDevices(hardware ?? [], model.devices);

    if (!probeFailed && hardware) {
      const missing = model.devices.filter(
        (device) => devicePresence(device, hardware) === "absent",
      );
      if (missing.length > 0) {
        return {
          id,
          state: "error",
          label,
          detail,
          message: t("views/system:health.hardware.deviceNotFound", {
            devices: missing.join(", "),
          }),
        };
      }
    }

    if (startup || !stats) {
      return {
        id,
        state: "unknown",
        label,
        detail,
        message: t("views/system:health.hardware.justStarted"),
      };
    }

    const detectors = stats.detectors ?? {};
    if (runners.some((name) => !detectors[name])) {
      return {
        id,
        state: "error",
        label,
        detail,
        message: t("views/system:health.hardware.detectorNotRunning"),
      };
    }

    const slowest = Math.max(
      ...runners.map((name) => detectors[name].inference_speed),
    );
    if (slowest > InferenceThreshold.error) {
      return {
        id,
        state: "error",
        label,
        detail,
        message: t("views/system:health.hardware.inferenceVerySlow", {
          speed: slowest,
        }),
      };
    }
    if (slowest > InferenceThreshold.warning) {
      return {
        id,
        state: "warning",
        label,
        detail,
        message: t("views/system:health.hardware.inferenceSlow", {
          speed: slowest,
        }),
      };
    }
    return {
      id,
      state: "ok",
      label,
      detail: [
        detail,
        t("views/system:health.hardware.inferenceMs", { speed: slowest }),
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}

// ------------------------------------------------------------------ hwaccel

export type HwaccelFamilyKey =
  | "nvidia"
  | "vaapi"
  | "intel-qsv"
  | "rkmpp"
  | "jetson"
  | "rpi"
  | "apple-silicon";

export type HwaccelClass =
  | { kind: "none" }
  | { kind: "custom" }
  | { kind: "preset"; family: HwaccelFamilyKey };

const PRESET_FAMILIES: [string, HwaccelFamilyKey][] = [
  ["preset-nvidia", "nvidia"],
  ["preset-vaapi", "vaapi"],
  ["preset-intel-qsv", "intel-qsv"],
  ["preset-rk", "rkmpp"],
  ["preset-jetson", "jetson"],
  ["preset-rpi", "rpi"],
  ["preset-apple-silicon", "apple-silicon"],
];

export function hwaccelFamily(value: string | string[]): HwaccelClass {
  if (Array.isArray(value)) {
    return value.length === 0 ? { kind: "none" } : { kind: "custom" };
  }
  // the backend resolves auto at startup; a literal auto left on an input
  // means no hardware decoding for it at runtime
  if (value === "" || value === "auto") return { kind: "none" };
  const match = PRESET_FAMILIES.find(([prefix]) => value.startsWith(prefix));
  return match ? { kind: "preset", family: match[1] } : { kind: "custom" };
}

const FAMILY_VENDORS: Record<HwaccelFamilyKey, GpuVendor[]> = {
  nvidia: ["nvidia"],
  jetson: ["nvidia"],
  "intel-qsv": ["intel"],
  vaapi: ["intel", "amd"],
  rkmpp: ["rockchip"],
  rpi: ["rpi"],
  // reports no decoder usage
  "apple-silicon": [],
};

function decoderUsage(
  family: HwaccelFamilyKey,
  stats: FrigateStats | undefined,
) {
  const entry = Object.values(stats?.gpu_usages ?? {}).find(
    (gpu) =>
      gpu.vendor && FAMILY_VENDORS[family].includes(gpu.vendor) && gpu.dec,
  );
  return entry?.dec;
}

type HwaccelArgs = {
  config: FrigateConfig;
  hwaccel: HwaccelRecommendation | undefined;
  hwaccelFailed: boolean;
  stats: FrigateStats | undefined;
  t: Translate;
  cameraName: (name: string) => string;
};

export function hwaccelRows({
  config,
  hwaccel,
  hwaccelFailed,
  stats,
  t,
  cameraName,
}: HwaccelArgs): HardwareRow[] {
  const cameras = activeCameras(config);
  const byValue = new Map<
    string,
    { value: string | string[]; cameras: string[] }
  >();

  for (const camera of cameras) {
    const values: (string | string[])[] = [camera.ffmpeg?.hwaccel_args ?? ""];
    for (const input of camera.ffmpeg?.inputs ?? []) {
      if (input.hwaccel_args && input.hwaccel_args.length > 0) {
        values.push(input.hwaccel_args);
      }
    }
    for (const value of values) {
      const key = Array.isArray(value) ? JSON.stringify(value) : value;
      const entry = byValue.get(key) ?? { value, cameras: [] };
      if (!entry.cameras.includes(camera.name)) entry.cameras.push(camera.name);
      byValue.set(key, entry);
    }
  }

  const familyName = (family: HwaccelFamilyKey | "none") =>
    t(`views/setup:setupWizard.hwaccel.families.${family}`);

  return [...byValue.entries()].map(([key, entry]): HardwareRow => {
    const id = `hwaccel:${key}`;
    const cameraList =
      entry.cameras.length === cameras.length
        ? t("views/system:health.hardware.allCameras")
        : entry.cameras.map(cameraName).join(", ");
    const classified = hwaccelFamily(entry.value);

    if (hwaccelFailed) {
      return {
        id,
        state: "unknown",
        label:
          classified.kind === "preset" ? familyName(classified.family) : key,
        detail: cameraList,
        message: t("views/system:health.hardware.probeUnavailable"),
      };
    }

    if (classified.kind === "custom") {
      return {
        id,
        state: "unknown",
        label: t("views/system:health.hardware.customArgs"),
        detail: cameraList,
        message: t("views/system:health.hardware.customArgsNotVerified"),
      };
    }

    const available = hwaccel?.available ?? [];

    if (classified.kind === "none") {
      if (available.length > 0 && hwaccel?.recommended) {
        return {
          id,
          state: "warning",
          label: familyName("none"),
          detail: cameraList,
          message: t("views/system:health.hardware.hwaccelNotConfigured", {
            family: familyName(hwaccel.recommended as HwaccelFamilyKey),
          }),
        };
      }
      return { id, state: "ok", label: familyName("none"), detail: cameraList };
    }

    const label = familyName(classified.family);
    // a warning, not an error: the probe and go2rtc disagree on whole
    // platform families
    if (!available.some((family) => family.key === classified.family)) {
      return {
        id,
        state: "warning",
        label,
        detail: cameraList,
        message: t("views/system:health.hardware.hwaccelHardwareMissing", {
          family: label,
        }),
      };
    }

    const dec = decoderUsage(classified.family, stats);
    return {
      id,
      state: "ok",
      label,
      detail: dec
        ? `${cameraList} · ${t("views/system:health.hardware.decoderUsage", { usage: dec })}`
        : cameraList,
    };
  });
}

// -------------------------------------------------------------- enrichments

const ANY_ACCELERATOR = [
  "onnx:nvidia",
  "onnx:amd",
  "openvino:GPU",
  "openvino:NPU",
  "rknn",
  "tensorrt",
];

/**
 * Probe keys that satisfy a requested device string. AUTO and the implicit
 * defaults accept any accelerator; an explicit override must match its own
 * hardware. Undefined means the string is not one we can check.
 */
export function acceleratorKeysFor(
  requested: string,
  nvidiaOnly: boolean,
): string[] | undefined {
  if (nvidiaOnly) return ["onnx:nvidia"];
  const upper = requested.toUpperCase();
  if (upper === "AUTO") return ANY_ACCELERATOR;
  // ONNX Runtime puts a plain GPU request on whichever GPU it has
  if (upper === "GPU") return ["openvino:GPU", "onnx:nvidia", "onnx:amd"];
  if (/^GPU\.\d+$/.test(upper)) return ["openvino:GPU"];
  if (upper === "NPU") return ["openvino:NPU"];
  if (upper.startsWith("CUDA") || upper.startsWith("TENSORRT")) {
    return ["onnx:nvidia"];
  }
  if (upper.startsWith("ROCM") || upper.startsWith("MIGRAPHX")) {
    return ["onnx:amd"];
  }
  return undefined;
}

type EnrichmentId =
  "semantic_search" | "face_recognition" | "lpr" | "audio_transcription";

type EnrichmentSpec = {
  id: EnrichmentId;
  enabled: boolean;
  /** what the config asks for, after the backend's own defaults */
  requested: string;
  explicit: boolean;
  remote: boolean;
  nvidiaOnly: boolean;
  /** runtime device is not reported for this enrichment */
  presenceOnly: boolean;
};

// the stats that time each enrichment's inference
const SPEED_KEYS: Record<EnrichmentId, string[]> = {
  semantic_search: ["image_embedding_speed", "text_embedding_speed"],
  face_recognition: ["face_recognition_speed"],
  lpr: ["plate_recognition_speed", "yolov9_plate_detection_speed"],
  audio_transcription: [],
};

function inferenceIsSlow(stats: FrigateStats | undefined, id: EnrichmentId) {
  return SPEED_KEYS[id].some((key) => {
    const value = stats?.embeddings?.[key];
    return typeof value === "number" && value > EmbeddingThreshold.warning;
  });
}

function enrichmentSpecs(config: FrigateConfig): EnrichmentSpec[] {
  const ss = config.semantic_search;
  const transcription = config.audio_transcription;
  const anyCameraTranscribes = Object.values(config.cameras).some(
    (camera) => camera.audio_transcription?.enabled,
  );

  return [
    {
      id: "semantic_search",
      enabled: !!ss?.enabled,
      requested: ss?.device ?? (ss?.model_size === "large" ? "GPU" : "CPU"),
      explicit: ss?.device != null,
      remote: !!ss?.model && ss.model !== "jinav1" && ss.model !== "jinav2",
      nvidiaOnly: false,
      presenceOnly: false,
    },
    {
      id: "face_recognition",
      enabled: !!config.face_recognition?.enabled,
      requested: config.face_recognition?.device ?? "GPU",
      explicit: config.face_recognition?.device != null,
      remote: false,
      nvidiaOnly: false,
      presenceOnly: false,
    },
    {
      id: "lpr",
      enabled: !!config.lpr?.enabled,
      requested: config.lpr?.device ?? "AUTO",
      explicit: config.lpr?.device != null,
      remote: false,
      nvidiaOnly: false,
      presenceOnly: false,
    },
    {
      id: "audio_transcription",
      enabled: !!transcription?.enabled || anyCameraTranscribes,
      requested: transcription?.device ?? "CPU",
      explicit: true,
      remote: !!transcription?.model && transcription.model !== "whisper",
      nvidiaOnly: true,
      presenceOnly: true,
    },
  ];
}

type EnrichmentArgs = {
  config: FrigateConfig;
  hardware: DetectionHardware[] | undefined;
  probeFailed: boolean;
  stats: FrigateStats | undefined;
  startup: boolean;
  t: Translate;
};

export function enrichmentRows({
  config,
  hardware,
  probeFailed,
  stats,
  startup,
  t,
}: EnrichmentArgs): HardwareRow[] {
  return enrichmentSpecs(config)
    .filter((spec) => spec.enabled)
    .map((spec): HardwareRow => {
      const id = `enrichment:${spec.id}`;
      const label = t(`views/system:health.hardware.enrichments.${spec.id}`);
      const upper = spec.requested.toUpperCase();

      if (spec.remote) {
        return {
          id,
          state: "ok",
          label,
          detail: t("views/system:health.hardware.remoteProvider"),
        };
      }
      if (upper === "CPU") return { id, state: "ok", label, detail: "CPU" };
      if (probeFailed) {
        return {
          id,
          state: "unknown",
          label,
          message: t("views/system:health.hardware.probeUnavailable"),
        };
      }

      // implicit defaults accept any accelerator; only an explicit override
      // is matched against its own hardware
      const keys = spec.explicit
        ? acceleratorKeysFor(spec.requested, spec.nvidiaOnly)
        : spec.nvidiaOnly
          ? ["onnx:nvidia"]
          : ANY_ACCELERATOR;

      if (!keys) {
        return {
          id,
          state: "unknown",
          label,
          message: t("views/system:health.hardware.unrecognizedDevice"),
        };
      }

      const present = (hardware ?? []).some((entry) =>
        keys.includes(entry.key),
      );
      const runtime = startup
        ? undefined
        : stats?.embeddings?.devices?.[spec.id];
      const runtimeIsCpu = !!runtime && runtime.toUpperCase().includes("CPU");

      // a model that reports an accelerator is proof enough
      if (runtime && !runtimeIsCpu) {
        return { id, state: "ok", label, detail: runtime };
      }

      const pinned = spec.explicit && upper !== "AUTO";
      if (pinned && hardware && !present) {
        return {
          id,
          state: "error",
          label,
          message: t("views/system:health.hardware.acceleratorMissing", {
            device: spec.requested,
          }),
        };
      }

      if (spec.presenceOnly) {
        return { id, state: "ok", label, detail: spec.requested };
      }

      if (!runtime) {
        return {
          id,
          state: "unknown",
          label,
          message:
            startup || !stats
              ? t("views/system:health.hardware.justStarted")
              : t("views/system:health.hardware.modelNotRunYet"),
        };
      }

      if (runtimeIsCpu && present && pinned) {
        return {
          id,
          state: "error",
          label,
          detail: "CPU",
          message: t("views/system:health.hardware.fellBackToCpu", {
            device: spec.requested,
          }),
        };
      }

      // a model that keeps up on the CPU needs no accelerator
      if (runtimeIsCpu && present && inferenceIsSlow(stats, spec.id)) {
        return {
          id,
          state: "warning",
          label,
          detail: "CPU",
          message: t("views/system:health.hardware.cpuDespiteAccelerator"),
        };
      }

      return { id, state: "ok", label, detail: runtimeIsCpu ? "CPU" : runtime };
    });
}

// ------------------------------------------------------- camera connections

export type CameraConnectionCell = {
  camera: string;
  quality: ConnectionQuality;
  cameraFps: number;
  expectedFps: number;
};

/** enabled, non replay cameras whose latest connection is not excellent */
export function cameraConnectionCells(
  config: FrigateConfig,
  stats: FrigateStats | undefined,
): CameraConnectionCell[] {
  if (!stats) return [];
  return activeCameras(config).flatMap((camera) => {
    const cam = stats.cameras[camera.name];
    if (!cam?.connection_quality || cam.connection_quality === "excellent") {
      return [];
    }
    return [
      {
        camera: camera.name,
        quality: cam.connection_quality,
        cameraFps: cam.camera_fps,
        expectedFps: cam.expected_fps ?? 0,
      },
    ];
  });
}
