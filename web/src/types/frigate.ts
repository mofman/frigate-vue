/** Subset of the Frigate API types the core UI consumes. */

export type ToggleableSetting = "ON" | "OFF";

export type CameraConfig = {
  name: string;
  friendly_name?: string;
  enabled: boolean;
  enabled_in_config: boolean;
  audio: { enabled: boolean; enabled_in_config: boolean };
  detect: { enabled: boolean; width: number; height: number; fps: number };
  record: { enabled: boolean; enabled_in_config: boolean };
  snapshots: { enabled: boolean };
  live: { height: number; quality: number; streams: Record<string, string> };
  audio_transcription?: {
    enabled?: boolean;
    enabled_in_config: boolean;
    live_enabled?: boolean;
  };
  ffmpeg?: {
    hwaccel_args?: string | string[];
    inputs: {
      path: string;
      roles: string[];
      hwaccel_args?: string | string[];
    }[];
  };
  notifications?: { enabled: boolean; enabled_in_config: boolean };
  objects?: { track: string[] };
  zones?: Record<string, unknown>;
  onvif?: { host?: string; autotracking?: { enabled_in_config: boolean } };
  ui: { order: number; dashboard: boolean };
  webui_url?: string | null;
};

export type CameraGroupConfig = {
  cameras: string[];
  icon: string;
  order: number;
};

export type FrigateConfig = {
  cameras: Record<string, CameraConfig>;
  camera_groups: Record<string, CameraGroupConfig>;
  go2rtc: {
    streams: Record<string, string | string[]>;
    webrtc?: {
      candidates?: string[];
      ice_servers?: {
        urls: string | string[];
        username?: string;
        credential?: string;
      }[];
    };
  };
  ui: {
    timezone?: string;
    time_format?: "browser" | "12hour" | "24hour";
    date_style?: "full" | "long" | "medium" | "short";
    time_style?: "full" | "long" | "medium" | "short";
  };
  proxy?: { logout_url?: string };
  model?: { attributes_map?: Record<string, string[]> };
  /** true when the config failed validation and Frigate started without it */
  safe_mode?: boolean;
  /** detection models, each running on one or more devices */
  models?: DetectionModelConfig[];
  semantic_search?: {
    enabled: boolean;
    model?: string;
    model_size?: "small" | "large";
    device?: string | null;
  };
  face_recognition?: { enabled: boolean; device?: string | null };
  lpr?: { enabled: boolean; device?: string | null };
  audio_transcription?: {
    enabled: boolean;
    model?: string;
    device?: string | null;
  };
};

export type DetectionModelConfig = {
  scene?: string;
  devices: string[];
};

export type UserProfile = {
  username: string;
  role: string;
  allowed_cameras?: string[] | null;
};

export type ObjectType = {
  id: string;
  label: string;
  stationary: boolean;
  area: number;
  ratio: number;
  score: number;
  sub_label: string;
};

export type FrigateCameraState = {
  config: {
    enabled: boolean;
    detect: boolean;
    snapshots: boolean;
    record: boolean;
    audio: boolean;
    autotracking: boolean;
    audio_transcription?: boolean;
    notifications?: boolean;
    notifications_suspended?: number;
  };
  motion: boolean;
  objects: ObjectType[];
};

type FrigateObjectState = {
  id: string;
  camera: string;
  label: string;
  sub_label: [string, number] | null;
  stationary: boolean;
  area: number;
  ratio: number;
  score: number;
};

export type FrigateEvent = {
  type: "new" | "update" | "end";
  before: FrigateObjectState;
  after: FrigateObjectState;
};

export type ReviewSeverity = "alert" | "detection" | "significant_motion";

export type ReviewSegment = {
  id: string;
  camera: string;
  severity: ReviewSeverity;
  start_time: number;
  end_time?: number;
  thumb_path: string;
  has_been_reviewed: boolean;
  data: {
    audio: string[];
    detections: string[];
    objects: string[];
    sub_labels?: string[];
    zones: string[];
    metadata?: { title: string; scene: string };
  };
};

export type FrigateReviewUpdate = {
  type: "new" | "update" | "end" | "genai";
  before: ReviewSegment;
  after: ReviewSegment;
};

export type ReviewSummaryDay = {
  day: string;
  reviewed_alert: number;
  reviewed_detection: number;
  total_alert: number;
  total_detection: number;
};

export type ReviewSummary = Record<string, ReviewSummaryDay>;

export type MotionData = {
  start_time: number;
  motion?: number;
  audio?: number;
  camera: string;
};

export type RecordingSpan = {
  start_time: number;
  end_time: number;
  /** playlist duration in seconds, may exceed wall length with lead-in */
  duration: number;
};

export type RecordingCoverage = {
  spans: { start_time: number; end_time: number; streams: string[] }[];
  timelines?: {
    auto: { start_time: number; end_time: number; duration: number }[];
    main: { start_time: number; end_time: number; duration: number }[];
    sub: { start_time: number; end_time: number; duration: number }[];
  };
};

export type UnavailableRange = {
  start_time: number;
  end_time: number;
};

export type Preview = {
  camera: string;
  src: string;
  type: string;
  start: number;
  end: number;
};

export type { FrigateStats, StorageStats } from "./stats";

export type Go2rtcStream = {
  producers?: { url?: string; medias?: string[] }[];
  consumers?: unknown[];
};

export type TimeRange = { after: number; before: number };
