import { describe, expect, it } from "vitest";
import type { DetectionHardware } from "@/types/health";
import type { FrigateStats } from "@/types/stats";
import {
  acceleratorKeysFor,
  detectionRows,
  devicePresence,
  hwaccelFamily,
  runnerNames,
} from "./health";

const t = (key: string) => key;

const coral: DetectionHardware = {
  key: "edgetpu",
  detector: "edgetpu",
  name: "Coral USB",
  units: [{ device: "edgetpu:usb:0", label: "USB" }],
  count: 1,
  unlimited: false,
};

function stats(detectors: Record<string, number>, uptime = 600): FrigateStats {
  return {
    cameras: {},
    cpu_usages: {},
    detectors: Object.fromEntries(
      Object.entries(detectors).map(([key, speed]) => [
        key,
        { detection_start: 0, pid: 1, inference_speed: speed },
      ]),
    ),
    service: { last_updated: 0, uptime, version: "0", storage: {} },
  };
}

describe("runnerNames", () => {
  it("numbers repeated devices the way the backend does", () => {
    expect(
      runnerNames([
        { devices: ["cpu", "cpu"] },
        { devices: ["cpu", "edgetpu:usb"] },
      ]),
    ).toEqual(["cpu", "cpu#2", "cpu#3", "edgetpu:usb"]);
  });
});

describe("devicePresence", () => {
  it("finds a device by unit prefix", () => {
    expect(devicePresence("edgetpu:usb", [coral])).toBe("present");
  });

  it("reports hardware the probe did not find", () => {
    expect(devicePresence("edgetpu:usb", [])).toBe("absent");
  });

  it("does not flag detectors that fall back to the CPU", () => {
    expect(devicePresence("openvino", [])).toBe("unverified");
    expect(devicePresence("cpu", [])).toBe("present");
  });

  it("cannot check detectors the probe does not cover", () => {
    expect(devicePresence("deepstack", [])).toBe("unverified");
  });
});

describe("detectionRows", () => {
  const models = [{ scene: "default", devices: ["edgetpu:usb"] }];

  it("is an error when the device is missing", () => {
    const [row] = detectionRows({
      models,
      hardware: [],
      probeFailed: false,
      stats: stats({ "edgetpu:usb": 10 }),
      startup: false,
      t,
    });
    expect(row.state).toBe("error");
    expect(row.message).toBe("views/system:health.hardware.deviceNotFound");
  });

  it("grades by the slowest runner", () => {
    const run = (speed: number) =>
      detectionRows({
        models,
        hardware: [coral],
        probeFailed: false,
        stats: stats({ "edgetpu:usb": speed }),
        startup: false,
        t,
      })[0].state;
    expect(run(10)).toBe("ok");
    expect(run(60)).toBe("warning");
    expect(run(150)).toBe("error");
  });

  it("is unknown right after startup", () => {
    const [row] = detectionRows({
      models,
      hardware: [coral],
      probeFailed: false,
      stats: stats({}, 10),
      startup: true,
      t,
    });
    expect(row.state).toBe("unknown");
  });
});

describe("hwaccelFamily", () => {
  it("classifies presets, custom args and none", () => {
    expect(hwaccelFamily("preset-vaapi")).toEqual({
      kind: "preset",
      family: "vaapi",
    });
    expect(hwaccelFamily("preset-nvidia-h264")).toEqual({
      kind: "preset",
      family: "nvidia",
    });
    expect(hwaccelFamily("auto")).toEqual({ kind: "none" });
    expect(hwaccelFamily([])).toEqual({ kind: "none" });
    expect(hwaccelFamily(["-hwaccel", "qsv"])).toEqual({ kind: "custom" });
  });
});

describe("acceleratorKeysFor", () => {
  it("narrows explicit device requests", () => {
    expect(acceleratorKeysFor("NPU", false)).toEqual(["openvino:NPU"]);
    expect(acceleratorKeysFor("cuda:0", false)).toEqual(["onnx:nvidia"]);
    expect(acceleratorKeysFor("GPU.1", false)).toEqual(["openvino:GPU"]);
    expect(acceleratorKeysFor("whatever", false)).toBeUndefined();
    expect(acceleratorKeysFor("AUTO", true)).toEqual(["onnx:nvidia"]);
  });
});
