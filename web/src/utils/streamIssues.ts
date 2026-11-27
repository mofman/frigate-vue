/** Advice about a camera stream, from its url, roles and probe result. */
import type {
  CameraBrand,
  ReolinkProtocol,
  StreamRole,
  TestResult,
} from "@/types/cameraWizard";

export type StreamIssue = {
  type: "good" | "warning" | "error";
  message: string;
  /** stable key for the rule that fired */
  rule: string;
};

export type StreamIssueInput = {
  url: string;
  roles: StreamRole[];
  brand?: CameraBrand;
  reolinkProtocol?: ReolinkProtocol | null;
  useFfmpeg?: boolean;
  restream?: boolean;
  testResult?: TestResult;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

function resolutionIssue(
  testResult: TestResult,
  t: Translate,
): StreamIssue | undefined {
  const resolution = testResult.resolution;
  const [width, height] = (resolution ?? "").split("x").map(Number);
  if (!(width > 0) || !(height > 0)) {
    return {
      type: "error",
      rule: "resolution-unknown",
      message: t("views/settings:cameraWizard.step4.issues.resolutionUnknown"),
    };
  }
  if (Math.min(width, height) > 1080) {
    return {
      type: "warning",
      rule: "resolution-high",
      message: t("views/settings:cameraWizard.step4.issues.resolutionHigh", {
        resolution,
      }),
    };
  }
  if (Math.max(width, height) < 640) {
    return {
      type: "error",
      rule: "resolution-low",
      message: t("views/settings:cameraWizard.step4.issues.resolutionLow", {
        resolution,
      }),
    };
  }
  return undefined;
}

export function getStreamIssues(
  input: StreamIssueInput,
  t: Translate,
): StreamIssue[] {
  const issues: StreamIssue[] = [];
  const { roles, testResult } = input;
  const url = input.url.toLowerCase();

  if (input.brand === "reolink") {
    if (url.startsWith("rtsp://") && input.reolinkProtocol !== "rtsp") {
      issues.push({
        type: "warning",
        rule: "reolink-rtsp",
        message: t(
          "views/settings:cameraWizard.step4.issues.brands.reolink-rtsp",
        ),
      });
    }
    if (url.startsWith("http://") && !input.useFfmpeg) {
      issues.push({
        type: "warning",
        rule: "reolink-http",
        message: t(
          "views/settings:cameraWizard.step4.issues.brands.reolink-http",
        ),
      });
    }
  }

  const videoCodec = testResult?.videoCodec;
  if (
    videoCodec &&
    ["h264", "h265", "hevc"].includes(videoCodec.toLowerCase())
  ) {
    issues.push({
      type: "good",
      rule: "video-codec",
      message: t("views/settings:cameraWizard.step4.issues.videoCodecGood", {
        codec: videoCodec,
      }),
    });
  }

  if (roles.includes("record")) {
    const audioCodec = testResult?.audioCodec;
    if (!audioCodec) {
      issues.push({
        type: "warning",
        rule: "no-audio",
        message: t("views/settings:cameraWizard.step4.issues.noAudioWarning"),
      });
    } else if (audioCodec.toLowerCase() === "aac") {
      issues.push({
        type: "good",
        rule: "audio-codec",
        message: t("views/settings:cameraWizard.step4.issues.audioCodecGood", {
          codec: audioCodec,
        }),
      });
    } else {
      issues.push({
        type: "error",
        rule: "audio-codec-record",
        message: t(
          "views/settings:cameraWizard.step4.issues.audioCodecRecordError",
        ),
      });
    }
  }

  if (roles.includes("audio") && !testResult?.audioCodec) {
    issues.push({
      type: "error",
      rule: "audio-required",
      message: t("views/settings:cameraWizard.step4.issues.audioCodecRequired"),
    });
  }

  if (roles.includes("record") && input.restream) {
    issues.push({
      type: "warning",
      rule: "restream",
      message: t("views/settings:cameraWizard.step4.issues.restreamingWarning"),
    });
  }

  if (roles.includes("detect")) {
    const issue = testResult && resolutionIssue(testResult, t);
    if (issue) issues.push(issue);

    if (input.brand === "dahua" && input.url.includes("subtype=1")) {
      issues.push({
        type: "warning",
        rule: "dahua-substream",
        message: t(
          "views/settings:cameraWizard.step4.issues.dahua.substreamWarning",
        ),
      });
    }
    if (input.brand === "hikvision" && input.url.includes("/102")) {
      issues.push({
        type: "warning",
        rule: "hikvision-substream",
        message: t(
          "views/settings:cameraWizard.step4.issues.hikvision.substreamWarning",
        ),
      });
    }
  }

  return issues;
}
