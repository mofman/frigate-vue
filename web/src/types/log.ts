/** Log viewer types. */

export const logServices = ["frigate", "go2rtc", "nginx"] as const;
export type LogService = (typeof logServices)[number];

export type LogSeverity = "debug" | "info" | "warning" | "error" | "unknown";

export type LogLine = {
  dateStamp: string;
  severity: LogSeverity;
  section: string;
  content: string;
};

/** /api/logs/{service} page */
export type LogPage = { totalLines: number; lines: string[] };
