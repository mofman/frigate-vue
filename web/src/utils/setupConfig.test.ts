import { describe, expect, it } from "vitest";
import type {
  DetectionHardware,
  HwaccelRecommendation,
} from "@/types/hardware";
import {
  cameraCodecs,
  clampRetentionDays,
  confirmPasswordError,
  detectorConfig,
  detectorDevices,
  hwaccelConfig,
  hwaccelParams,
  passwordError,
  recommendedDetectorCount,
  recordingConfig,
  recordingStorageEstimate,
  usernameError,
} from "./setupConfig";

const recommendation: HwaccelRecommendation = {
  recommended: "vaapi",
  available: [
    { key: "vaapi", presets: { any: "preset-vaapi" } },
    {
      key: "nvidia",
      presets: { h264: "preset-nvidia-h264", h265: "preset-nvidia-h265" },
    },
  ],
};

const gpu: DetectionHardware = {
  key: "openvino:GPU",
  detector: "openvino",
  name: "Intel GPU",
  units: [{ device: "openvino:GPU.0", label: "GPU" }],
  count: 1,
  unlimited: true,
};

describe("hwaccel config", () => {
  it("normalizes codecs and builds the recommendation query", () => {
    const cameras = cameraCodecs({ front: "HEVC", back: "h264", side: "h264" });
    expect(cameras[0]).toEqual({ camera: "front", codec: "h265" });
    expect(hwaccelParams("cpu", cameras)).toEqual({
      detector: "cpu",
      codecs: "h265,h264",
    });
    expect(hwaccelParams(undefined, []).codecs).toBeUndefined();
  });

  it("uses the recommended family for auto", () => {
    expect(hwaccelConfig("auto", recommendation, [])).toEqual({
      ffmpeg: { hwaccel_args: "preset-vaapi" },
    });
  });

  it("writes an empty list for none so auto is not revived", () => {
    expect(hwaccelConfig("none", undefined, [])).toEqual({
      ffmpeg: { hwaccel_args: [] },
    });
  });

  it("shares a preset when every camera resolves to it", () => {
    expect(
      hwaccelConfig("nvidia", recommendation, [
        { camera: "a", codec: "h264" },
        { camera: "b", codec: "h264" },
      ]),
    ).toEqual({ ffmpeg: { hwaccel_args: "preset-nvidia-h264" } });
  });

  it("writes per camera presets when codecs differ", () => {
    expect(
      hwaccelConfig("nvidia", recommendation, [
        { camera: "a", codec: "h264" },
        { camera: "b", codec: "h265" },
      ]),
    ).toEqual({
      cameras: {
        a: { ffmpeg: { hwaccel_args: "preset-nvidia-h264" } },
        b: { ffmpeg: { hwaccel_args: "preset-nvidia-h265" } },
      },
    });
  });

  it("falls back to the first preset without a matching camera", () => {
    expect(hwaccelConfig("nvidia", recommendation, [])).toEqual({
      ffmpeg: { hwaccel_args: "preset-nvidia-h264" },
    });
  });

  it("writes nothing for an unknown family", () => {
    expect(hwaccelConfig("auto", undefined, [])).toBeNull();
  });
});

describe("detector config", () => {
  it("scales detectors with cameras up to the limit", () => {
    expect(recommendedDetectorCount(0)).toBe(1);
    expect(recommendedDetectorCount(9)).toBe(2);
    expect(recommendedDetectorCount(500)).toBe(8);
  });

  it("repeats unlimited devices only", () => {
    expect(detectorDevices(gpu, 9)).toHaveLength(2);
    expect(detectorDevices({ ...gpu, unlimited: false }, 9)).toEqual([
      "openvino:GPU.0",
    ]);
    expect(detectorDevices({ ...gpu, units: [] }, 9)).toEqual([]);
  });

  it("adds a Frigate+ model path when one is chosen", () => {
    expect(detectorConfig(gpu, 1, "abc")).toEqual({
      models: [{ devices: ["openvino:GPU.0"], path: "plus://abc" }],
      detect: { enabled: true },
    });
  });
});

describe("recording config", () => {
  it("clamps retention", () => {
    expect(clampRetentionDays("0")).toBe(1);
    expect(clampRetentionDays("900")).toBe(365);
    expect(clampRetentionDays("nope")).toBe(1);
  });

  it("turns continuous recording off for event recording", () => {
    expect(recordingConfig(true, "events", 7)).toEqual({
      record: {
        enabled: true,
        alerts: { retain: { days: 7 } },
        detections: { retain: { days: 7 } },
        continuous: { days: 0 },
      },
    });
  });

  it("keeps continuous days and omits retention when disabled", () => {
    const continuous = recordingConfig(true, "continuous", 3).record as {
      continuous: { days: number };
    };
    expect(continuous.continuous.days).toBe(3);
    expect(recordingConfig(false, "events", 3)).toEqual({
      record: { enabled: false },
    });
  });

  it("estimates days from free space", () => {
    expect(recordingStorageEstimate(1024 * 1000, 2)).toEqual({
      free: 1000,
      days: 24,
    });
    expect(recordingStorageEstimate(1000, 0)).toBeNull();
  });
});

describe("account validation", () => {
  it("validates usernames", () => {
    expect(usernameError("")).toContain("usernameIsRequired");
    expect(usernameError("a b")).toContain("usernameOnlyInclude");
    expect(usernameError("...")).toContain("usernameOnlyDots");
    expect(usernameError("front.desk_1")).toBe("");
  });

  it("validates passwords", () => {
    expect(passwordError("short")).toContain("requirements.length");
    expect(passwordError("long-enough-pass")).toBe("");
    expect(confirmPasswordError("a", "")).toContain("confirmPassword");
    expect(confirmPasswordError("a", "b")).toContain("notMatch");
    expect(confirmPasswordError("a", "a")).toBe("");
  });
});
