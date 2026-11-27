import { describe, expect, it } from "vitest";
import { getStreamIssues, type StreamIssueInput } from "./streamIssues";

const t = (key: string) => key;
const rules = (input: StreamIssueInput) =>
  getStreamIssues(input, t).map((issue) => issue.rule);

describe("getStreamIssues", () => {
  it("praises supported codecs", () => {
    expect(
      rules({
        url: "rtsp://cam",
        roles: ["record"],
        testResult: { success: true, videoCodec: "h264", audioCodec: "aac" },
      }),
    ).toEqual(["video-codec", "audio-codec"]);
  });

  it("flags audio problems by role", () => {
    expect(
      rules({
        url: "rtsp://cam",
        roles: ["record", "audio"],
        restream: true,
        testResult: { success: true },
      }),
    ).toEqual(["no-audio", "audio-required", "restream"]);
    expect(
      rules({
        url: "rtsp://cam",
        roles: ["record"],
        testResult: { success: true, audioCodec: "pcm_alaw" },
      }),
    ).toEqual(["audio-codec-record"]);
  });

  it("checks the detect resolution", () => {
    const issue = (resolution?: string) =>
      rules({
        url: "rtsp://cam",
        roles: ["detect"],
        testResult: { success: true, resolution },
      });
    expect(issue()).toEqual(["resolution-unknown"]);
    expect(issue("3840x2160")).toEqual(["resolution-high"]);
    expect(issue("320x240")).toEqual(["resolution-low"]);
    expect(issue("1280x720")).toEqual([]);
  });

  it("applies brand rules", () => {
    expect(rules({ url: "rtsp://cam", roles: [], brand: "reolink" })).toEqual([
      "reolink-rtsp",
    ]);
    expect(
      rules({ url: "http://cam/flv", roles: [], brand: "reolink" }),
    ).toEqual(["reolink-http"]);
    expect(
      rules({ url: "rtsp://cam?subtype=1", roles: ["detect"], brand: "dahua" }),
    ).toEqual(["dahua-substream"]);
    expect(
      rules({
        url: "rtsp://cam/Channels/102",
        roles: ["detect"],
        brand: "hikvision",
      }),
    ).toEqual(["hikvision-substream"]);
  });
});
