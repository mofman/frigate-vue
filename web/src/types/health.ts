/** Health tab: registry notices and hardware checks. */

export type HealthSeverity = "error" | "warning" | "info";
export type NoticeCategory = "camera" | "detector" | "model" | "system";

/** A notice from the backend registry, /api/notices and the notices topic. */
export type Notice = {
  id: string;
  kind: string;
  severity: HealthSeverity;
  category: NoticeCategory;
  scope: string | null;
  params: Record<string, string | number | boolean>;
  /** app route or absolute URL */
  link: string | null;
  first_seen: number;
  last_seen: number;
  count: number;
  /** whether the kind repeats, so acknowledging can hide it until next time */
  acknowledgeable: boolean;
  acknowledged_at: number | null;
  muted_at: number | null;
};

/** What the Health tab's filter shows. */
export type NoticeFilter = {
  showHidden: boolean;
  severities: HealthSeverity[];
};

export const DEFAULT_NOTICE_FILTER: NoticeFilter = {
  showHidden: false,
  severities: ["error", "warning", "info"],
};

export type HealthState = "ok" | "warning" | "error" | "unknown";

export type HardwareRow = {
  id: string;
  state: HealthState;
  label: string;
  /** muted text on the label line, what is actually running */
  detail?: string;
  /** reason line under the label, colored by state */
  message?: string;
};

export type HardwareUnit = { device: string; label: string };

export type DetectionHardware = {
  key: string;
  detector: string;
  name: string;
  units: HardwareUnit[];
  count: number;
  unlimited: boolean;
};

export type HwaccelRecommendation = {
  recommended: string;
  available: { key: string; presets: Record<string, string> }[];
};
