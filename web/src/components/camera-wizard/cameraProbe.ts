/** Requests the Add Camera wizard makes while inspecting a camera. */
import { buildUrl, errorMessage, http } from "@/api/http";
import type {
  FfprobeEntry,
  Go2rtcStreamInfo,
  OnvifProbeResponse,
  ReolinkProtocol,
  TestResult,
  WizardData,
} from "@/types/cameraWizard";
import { ffprobeToTestResult, hasTwoWayAudio } from "@/utils/cameraWizard";

const PROBE_TIMEOUT_MS = 10_000;
const ONVIF_TIMEOUT_MS = 30_000;

function readDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchSnapshot(url: string) {
  try {
    const response = await fetch(buildUrl("ffprobe/snapshot", { url }), {
      credentials: "include",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return response.ok ? await readDataUrl(await response.blob()) : undefined;
  } catch {
    // the snapshot is a nicety, the stream details are what matter
    return undefined;
  }
}

/** Probe a stream url. Failures are returned, never thrown. */
export async function probeStream(
  url: string,
  options: { snapshot?: boolean; onSnapshot?: () => void } = {},
): Promise<TestResult> {
  let result: TestResult;
  try {
    const entries = await http.get<FfprobeEntry[]>("ffprobe", {
      params: { paths: url, detailed: true },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    result = ffprobeToTestResult(entries[0]);
  } catch (error) {
    return { success: false, error: errorMessage(error) };
  }
  if (result.success && options.snapshot) {
    options.onSnapshot?.();
    result.snapshot = await fetchSnapshot(url);
  }
  return result;
}

export function probeOnvif(data: WizardData) {
  return http.get<OnvifProbeResponse>("onvif/probe", {
    params: {
      host: data.host,
      port: data.onvifPort ?? 80,
      username: data.username ?? "",
      password: data.password ?? "",
      test: false,
      auth_type: data.useDigestAuth ? "digest" : "basic",
    },
    signal: AbortSignal.timeout(ONVIF_TIMEOUT_MS),
  });
}

export async function detectReolinkProtocol(
  data: WizardData,
): Promise<ReolinkProtocol | null> {
  try {
    const result = await http.get<{
      success?: boolean;
      protocol?: ReolinkProtocol;
    }>("reolink/detect", {
      params: {
        host: data.host,
        username: data.username,
        password: data.password,
      },
    });
    return result.success && result.protocol ? result.protocol : null;
  } catch {
    return null;
  }
}

export async function streamHasBackchannel(stream: string) {
  try {
    const info = await http.get<Go2rtcStreamInfo>(
      `go2rtc/streams/${encodeURIComponent(stream)}`,
    );
    return hasTwoWayAudio(info);
  } catch {
    return false;
  }
}
