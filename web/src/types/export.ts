/** Types for the export API (`frigate/api/export.py`). */

export type Export = {
  id: string;
  camera: string;
  name: string;
  date: number;
  video_path: string;
  thumb_path: string;
  in_progress: boolean;
  export_case?: string | null;
  export_case_id?: string | null;
};

export type ExportCase = {
  id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
};

export type ExportStream = "auto" | "main" | "sub";

export type StartExportResponse = {
  success: boolean;
  message: string;
  export_id?: string | null;
  status?: string | null;
};

export type BatchExportItem = {
  camera: string;
  start_time: number;
  end_time: number;
  friendly_name?: string;
};

export type BatchExportResult = {
  camera: string;
  export_id?: string | null;
  success: boolean;
  error?: string | null;
};

export type BatchExportResponse = {
  export_case_id?: string | null;
  export_ids: string[];
  results: BatchExportResult[];
};

export type ExportJob = {
  id: string;
  job_type: string;
  status: string;
  camera: string;
  name?: string | null;
  export_case_id?: string | null;
  request_start_time: number;
  request_end_time: number;
  error_message?: string | null;
  current_step?: string;
  progress_percent?: number;
};

/** `job_state` websocket payload: one entry per job type. */
export type JobState = Record<
  string,
  { job_type: string; status: string; results?: { jobs?: ExportJob[] } }
>;
