/** Data collected by the Add Camera wizard and the APIs it talks to. */
export const CAMERA_BRANDS = [
  {
    value: "dahua",
    label: "Dahua / Amcrest / EmpireTech",
    template:
      "rtsp://{username}:{password}@{host}:554/cam/realmonitor?channel=1&subtype=0",
    exampleUrl:
      "rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0",
  },
  {
    value: "hikvision",
    label: "Hikvision / Uniview / Annke",
    template: "rtsp://{username}:{password}@{host}:554/Streaming/Channels/101",
    exampleUrl:
      "rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101",
  },
  {
    value: "ubiquiti",
    label: "Ubiquiti",
    template: "rtsp://{username}:{password}@{host}:554/live/ch0",
    exampleUrl: "rtsp://ubnt:password@192.168.1.100:554/live/ch0",
  },
  {
    value: "reolink",
    label: "Reolink",
    template: "dynamic",
    dynamicTemplates: {
      "http-flv":
        "http://{host}/flv?port=1935&app=bcs&stream=channel0_main.bcs&user={username}&password={password}",
      rtsp: "rtsp://{username}:{password}@{host}:554/Preview_01_main",
    },
    exampleUrl:
      "http://192.168.1.100/flv?port=1935&app=bcs&stream=channel0_main.bcs&user=admin&password=password or rtsp://admin:password@192.168.1.100:554/Preview_01_main",
  },
  {
    value: "axis",
    label: "Axis",
    template: "rtsp://{username}:{password}@{host}:554/axis-media/media.amp",
    exampleUrl: "rtsp://root:password@192.168.1.100:554/axis-media/media.amp",
  },
  {
    value: "tplink",
    label: "TP-Link",
    template: "rtsp://{username}:{password}@{host}:554/stream1",
    exampleUrl: "rtsp://admin:password@192.168.1.100:554/stream1",
  },
  {
    value: "foscam",
    label: "Foscam",
    template: "rtsp://{username}:{password}@{host}:88/videoMain",
    exampleUrl: "rtsp://admin:password@192.168.1.100:88/videoMain",
  },
  {
    value: "other",
    label: "Other",
    template: "",
    exampleUrl: "rtsp://username:password@host:port/path",
  },
] as const;

export type CameraBrand = (typeof CAMERA_BRANDS)[number]["value"];
export type ReolinkProtocol = "http-flv" | "rtsp";
export type StreamRole = "detect" | "record" | "record_sub" | "audio";

export const STREAM_ROLES: StreamRole[] = [
  "detect",
  "record",
  "record_sub",
  "audio",
];

export type TestResult = {
  success: boolean;
  /** data url */
  snapshot?: string;
  resolution?: string;
  videoCodec?: string;
  audioCodec?: string;
  fps?: number;
  error?: string;
};

export type StreamConfig = {
  id: string;
  url: string;
  roles: StreamRole[];
  testResult?: TestResult;
  userTested?: boolean;
  useFfmpeg?: boolean;
  restream?: boolean;
};

export type OnvifRtspCandidate = {
  source: "GetStreamUri" | "pattern";
  profile_token?: string;
  uri: string;
};

export type OnvifProbeResponse = {
  success: boolean;
  manufacturer?: string;
  model?: string;
  firmware_version?: string;
  profiles_count?: number;
  ptz_supported?: boolean;
  pan_tilt_supported?: boolean;
  presets_count?: number;
  autotrack_supported?: boolean;
  rtsp_candidates?: OnvifRtspCandidate[];
  message?: string;
};

export type OnvifSettings = {
  enabled: boolean;
  host: string;
  port: number;
  user?: string;
  password?: string;
};

export type WizardData = {
  cameraName?: string;
  host?: string;
  username?: string;
  password?: string;
  brandTemplate?: CameraBrand;
  reolinkProtocol?: ReolinkProtocol | null;
  customUrl?: string;
  streams: StreamConfig[];
  probeMode?: boolean;
  onvifPort?: number;
  useDigestAuth?: boolean;
  probeResult?: OnvifProbeResponse;
  probeCandidates?: string[];
  candidateTests?: Record<string, TestResult>;
  appleCompatibility?: boolean;
  onvif?: OnvifSettings;
};

export type FfprobeStream = {
  codec_name?: string;
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
};

export type FfprobeEntry = {
  return_code?: number;
  stdout?: { streams?: FfprobeStream[] } | string;
  /** the backend sends a list of non-empty lines on failure */
  stderr?: string | string[];
};

export type Go2rtcStreamInfo = {
  producers?: { medias?: string[] }[];
};
