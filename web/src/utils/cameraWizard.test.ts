import { describe, expect, it } from "vitest";
import type { StreamConfig, WizardData } from "@/types/cameraWizard";
import {
  brandStreamUrls,
  buildCameraConfig,
  buildGo2rtcStreams,
  calculateDetectDimensions,
  canContinueNameStep,
  canLeaveStep,
  ffprobeToTestResult,
  hasTwoWayAudio,
  hevcRecordingStreamId,
  isRoleBlocked,
  maskUri,
  processCameraName,
  validateNameStep,
  type NameStepForm,
} from "./cameraWizard";

const form: NameStepForm = {
  cameraName: "Front Door",
  host: "192.168.1.10",
  probeMode: true,
  brand: "dahua",
  customUrl: "",
  onvifPort: "80",
};

const stream = (overrides: Partial<StreamConfig> = {}): StreamConfig => ({
  id: "one",
  url: "rtsp://u:p@cam/main",
  roles: ["detect"],
  ...overrides,
});

describe("camera names", () => {
  it("normalizes spaces and keeps the friendly name", () => {
    expect(processCameraName("Front Door")).toEqual({
      name: "front_door",
      friendlyName: "Front Door",
    });
    expect(processCameraName("garage")).toEqual({
      name: "garage",
      friendlyName: undefined,
    });
  });

  it("hashes names that are not valid identifiers", () => {
    const result = processCameraName("玄関");
    expect(result.name).toMatch(/^cam_[a-f][0-9a-f]{7}$|^cam_[a-f0-9]{8}$/);
    expect(result.friendlyName).toBe("玄関");
    expect(processCameraName("玄関").name).toBe(result.name);
  });
});

describe("name step", () => {
  it("rejects a name that resolves to an existing camera", () => {
    expect(validateNameStep(form, ["front_door"]).cameraName).toContain(
      "nameExists",
    );
  });

  it("validates the ONVIF port only when probing", () => {
    const bad = { ...form, onvifPort: "70000" };
    expect(validateNameStep(bad, []).onvifPort).toContain("onvifPortInvalid");
    expect(validateNameStep({ ...bad, probeMode: false }, [])).toEqual({});
  });

  it("requires an rtsp custom url", () => {
    const custom = { ...form, probeMode: false, brand: "other" as const };
    expect(
      validateNameStep({ ...custom, customUrl: "http://cam" }, []).customUrl,
    ).toContain("customUrlRtspRequired");
    expect(
      validateNameStep({ ...custom, customUrl: "rtsps://cam" }, []),
    ).toEqual({});
  });

  it("needs a host, or a url for a custom brand", () => {
    expect(canContinueNameStep({ ...form, host: " " })).toBe(false);
    expect(
      canContinueNameStep({
        ...form,
        probeMode: false,
        brand: "other",
        host: "",
        customUrl: "rtsp://cam",
      }),
    ).toBe(true);
  });
});

describe("step gates", () => {
  it("needs a detect stream and valid ONVIF details", () => {
    const data: WizardData = { streams: [stream({ roles: ["record"] })] };
    expect(canLeaveStep(2, data)).toBe(false);
    data.streams = [stream()];
    expect(canLeaveStep(2, data)).toBe(true);
    data.onvif = { enabled: true, host: "", port: 80 };
    expect(canLeaveStep(2, data)).toBe(false);
  });
});

describe("maskUri", () => {
  it("masks rtsp, rtsps and passwords containing @", () => {
    expect(maskUri("rtsp://admin:p@ss@cam:554/a")).toBe(
      "rtsp://admin:****@cam:554/a",
    );
    expect(maskUri("rtsps://admin:secret@cam/a")).toBe(
      "rtsps://admin:****@cam/a",
    );
  });

  it("masks password query parameters", () => {
    expect(maskUri("http://cam/flv?user=a&password=secret")).toBe(
      "http://cam/flv?user=a&password=****",
    );
  });

  it("leaves other values alone", () => {
    expect(maskUri("rtsp://cam/a")).toBe("rtsp://cam/a");
    expect(maskUri("not a url")).toBe("not a url");
  });
});

describe("brand urls", () => {
  const data: WizardData = {
    streams: [],
    host: "cam",
    username: "admin",
    password: "pa$&word",
  };

  it("fills a template without interpreting the password", () => {
    expect(brandStreamUrls({ ...data, brandTemplate: "tplink" })).toEqual([
      "rtsp://admin:pa$&word@cam:554/stream1",
    ]);
  });

  it("tries http-flv first when Reolink recommends rtsp", () => {
    const urls = brandStreamUrls({ ...data, brandTemplate: "reolink" }, "rtsp");
    expect(urls).toHaveLength(2);
    expect(urls[0]).toMatch(/^http:/);
    expect(urls[1]).toMatch(/^rtsp:/);
  });

  it("uses the custom url for other", () => {
    expect(
      brandStreamUrls({
        streams: [],
        brandTemplate: "other",
        customUrl: "rtsp://x",
      }),
    ).toEqual(["rtsp://x"]);
  });
});

describe("ffprobe results", () => {
  it("reads streams from object or string output", () => {
    const stdout = {
      streams: [
        {
          codec_type: "video",
          codec_name: "hevc",
          width: 1920,
          height: 1080,
          avg_frame_rate: "30000/1001",
        },
        { codec_type: "audio", codec_name: "pcm_alaw" },
      ],
    };
    const expected = {
      success: true,
      resolution: "1920x1080",
      videoCodec: "hevc",
      audioCodec: "pcm_alaw",
      fps: 29.97,
    };
    expect(ffprobeToTestResult({ return_code: 0, stdout })).toEqual(expected);
    expect(
      ffprobeToTestResult({ return_code: 0, stdout: JSON.stringify(stdout) }),
    ).toEqual(expected);
  });

  it("reports the error text on failure", () => {
    expect(
      ffprobeToTestResult({ return_code: 1, stderr: ["bad", "auth"] }),
    ).toEqual({ success: false, error: "bad\nauth" });
    expect(ffprobeToTestResult(undefined).success).toBe(false);
  });
});

describe("stream helpers", () => {
  it("scales detect dimensions without upscaling", () => {
    expect(calculateDetectDimensions(3840, 2160)).toEqual({
      width: 1280,
      height: 720,
    });
    expect(calculateDetectDimensions(640, 480)).toEqual({
      width: 640,
      height: 480,
    });
    expect(calculateDetectDimensions(0, 480)).toBeNull();
  });

  it("finds H.265 recording streams", () => {
    expect(
      hevcRecordingStreamId([
        stream({ testResult: { success: true, videoCodec: "hevc" } }),
        stream({
          id: "two",
          roles: ["record"],
          testResult: { success: true, videoCodec: "HEVC" },
        }),
      ]),
    ).toBe("two");
  });

  it("blocks roles used elsewhere and conflicting record roles", () => {
    const first = stream({ roles: ["detect", "record"] });
    const second = stream({ id: "two", roles: [] });
    const streams = [first, second];
    expect(isRoleBlocked(second, "detect", streams)).toBe(true);
    expect(isRoleBlocked(first, "record_sub", streams)).toBe(true);
    expect(isRoleBlocked(first, "record", streams)).toBe(false);
    expect(isRoleBlocked(second, "audio", streams)).toBe(false);
  });

  it("detects two way audio", () => {
    expect(
      hasTwoWayAudio({ producers: [{ medias: ["audio, sendonly, PCMA"] }] }),
    ).toBe(true);
    expect(
      hasTwoWayAudio({ producers: [{ medias: ["video, recvonly"] }] }),
    ).toBe(false);
  });
});

describe("saved config", () => {
  it("builds one camera with a restreamed input", () => {
    const { name, friendlyName, body } = buildCameraConfig({
      cameraName: "Front Door",
      streams: [
        stream({
          restream: true,
          testResult: { success: true, resolution: "2560x1440" },
        }),
      ],
      onvif: {
        enabled: true,
        host: " cam ",
        port: 80,
        user: "",
        password: "x",
      },
    });
    expect(name).toBe("front_door");
    expect(friendlyName).toBe("Front Door");
    expect(body.update_topic).toBe("config/cameras/front_door/add");
    expect(body.config_data.cameras.front_door).toEqual({
      enabled: true,
      friendly_name: "Front Door",
      ffmpeg: {
        inputs: [
          {
            path: "rtsp://127.0.0.1:8554/front_door",
            input_args: "preset-rtsp-restream",
            roles: ["detect"],
          },
        ],
      },
      live: { streams: { "Stream 1": "front_door" } },
      detect: { width: 1280, height: 720 },
      onvif: { host: "cam", port: 80, password: "x" },
    });
  });

  it("numbers streams and keeps apple compatibility only for H.265", () => {
    const streams = [
      stream(),
      stream({
        id: "two",
        url: "rtsp://cam/sub",
        roles: ["record"],
        testResult: { success: true, videoCodec: "hevc" },
      }),
    ];
    const camera = buildCameraConfig({
      cameraName: "gate",
      streams,
      appleCompatibility: true,
    }).body.config_data.cameras.gate as {
      ffmpeg: { apple_compatibility?: boolean };
      live: { streams: Record<string, string> };
    };
    expect(camera.ffmpeg.apple_compatibility).toBe(true);
    expect(camera.live.streams).toEqual({
      "Stream 1": "gate_1",
      "Stream 2": "gate_2",
    });
  });

  it("builds go2rtc sources with ffmpeg and backchannel", () => {
    expect(
      buildGo2rtcStreams("gate", [stream({ useFfmpeg: true })], true),
    ).toEqual({
      gate: [
        "ffmpeg:rtsp://u:p@cam/main#backchannel=0",
        "ffmpeg:rtsp://u:p@cam/main",
      ],
    });
  });
});
