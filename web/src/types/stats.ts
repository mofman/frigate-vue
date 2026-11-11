/** Shapes of /api/stats, /api/stats/history and the related system endpoints. */

export type ConnectionQuality = "excellent" | "fair" | "poor" | "unusable";

export type CameraStats = {
  camera_fps: number;
  detection_fps: number;
  process_fps?: number;
  skipped_fps?: number;
  skipped_pct?: number;
  detection_enabled?: number;
  pid?: number;
  capture_pid?: number;
  ffmpeg_pid?: number;
  audio_dBFPS?: number;
  audio_rms?: number;
  connection_quality?: ConnectionQuality;
  expected_fps?: number;
  reconnects_last_hour?: number;
  stalls_last_hour?: number;
  ffmpeg_cpu?: string;
  capture_cpu?: string;
  detect_cpu?: string;
};

export type CpuStats = {
  cmdline?: string;
  cpu: string;
  cpu_average?: string;
  mem: string;
};

export type DetectorStats = {
  detection_start: number;
  inference_speed: number;
  pid: number;
  temperature?: number;
  cpu?: string;
  mem?: string;
};

/** Speeds are numbers; `devices` maps each enrichment to where it runs. */
export type EmbeddingsStats = {
  devices?: Record<string, string>;
  [key: string]: number | Record<string, string> | undefined;
};

export type ExtraProcessStats = { pid: number; cpu?: string; mem?: string };

export type GpuVendor = "intel" | "amd" | "nvidia" | "rockchip" | "rpi";

export type GpuStats = {
  vendor?: GpuVendor;
  gpu: string;
  mem: string;
  enc?: string;
  dec?: string;
  compute?: string;
  pstate?: string;
  temp?: number;
};

export type NpuStats = { npu: number; mem?: string; temp?: number };

export type StorageStats = {
  free: number;
  total: number;
  used: number;
  mount_type?: string;
  min_shm?: number;
  shm_frame_count?: number;
};

export type ServiceStats = {
  last_updated: number;
  storage: Record<string, StorageStats>;
  uptime: number;
  latest_version?: string;
  version: string;
  retention_unmet?: boolean;
};

export type FrigateStats = {
  cameras: Record<string, CameraStats>;
  cpu_usages: Record<string, CpuStats>;
  detectors?: Record<string, DetectorStats>;
  embeddings?: EmbeddingsStats;
  gpu_usages?: Record<string, GpuStats>;
  npu_usages?: Record<string, NpuStats>;
  processes?: Record<string, ExtraProcessStats>;
  service: ServiceStats;
  camera_fps?: number;
  process_fps?: number;
  skipped_fps?: number;
  detection_fps?: number;
};

export type StreamStorage = { usage: number; bandwidth: number | null };

/** /api/recordings/storage, sizes in MiB and bandwidth in MiB per hour. */
export type CameraStorage = Record<
  string,
  {
    bandwidth: number;
    usage: number;
    usage_percent: number;
    streams?: { main?: StreamStorage; sub?: StreamStorage };
  }
>;

export type GpuInfoKind = "vainfo" | "nvinfo";

export type Vainfo = { return_code: number; stdout: string; stderr: string };

export type Nvinfo = Record<
  string,
  { name: string; driver: string; cuda_compute: string; vbios: string }
>;

export type FfprobeStream = {
  avg_frame_rate?: string;
  codec_long_name?: string;
  codec_type?: string;
  height?: number;
  width?: number;
};

export type Ffprobe = {
  return_code: number;
  stderr: string;
  stdout: { programs?: unknown[]; streams?: FfprobeStream[] } | string;
};

/** Warning and error lines a metric is judged against. */
export type Threshold = { warning: number; error: number };

export const InferenceThreshold: Threshold = { warning: 50, error: 100 };
export const EmbeddingThreshold: Threshold = { warning: 500, error: 1000 };
export const GenAIThreshold: Threshold = { warning: 60, error: 120 };
export const DetectorTempThreshold: Threshold = { warning: 72, error: 80 };
export const DetectorCpuThreshold: Threshold = { warning: 25, error: 50 };
export const DetectorMemThreshold: Threshold = { warning: 20, error: 50 };
export const GpuUsageThreshold: Threshold = { warning: 75, error: 95 };
export const GpuMemThreshold: Threshold = { warning: 75, error: 95 };
