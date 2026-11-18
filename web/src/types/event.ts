/** Tracked objects as returned by the events API, and Explore's search state. */

export type SearchSource = "similarity" | "thumbnail" | "description";

export type SearchSort =
  | "date_asc"
  | "date_desc"
  | "score_asc"
  | "score_desc"
  | "speed_asc"
  | "speed_desc"
  | "relevance";

export type TrackedEventType = "object" | "audio" | "manual";

export type TrackedEvent = {
  id: string;
  camera: string;
  label: string;
  sub_label?: string | null;
  start_time: number;
  end_time?: number | null;
  score?: number;
  top_score?: number;
  false_positive?: boolean | null;
  plus_id?: string | null;
  has_snapshot: boolean;
  has_clip: boolean;
  retain_indefinitely?: boolean;
  zones: string[];
  /** only on events/search results */
  search_source?: SearchSource;
  search_distance?: number;
  /** only on events/explore results */
  event_count?: number;
  data: {
    type?: TrackedEventType;
    score?: number;
    top_score?: number;
    sub_label_score?: number;
    region?: number[];
    box?: number[];
    area?: number;
    ratio?: number;
    attributes?: { box: number[]; label: string; score: number }[];
    description?: string;
    average_estimated_speed?: number;
    velocity_angle?: number;
    path_data?: [[number, number], number][];
    recognized_license_plate?: string;
    recognized_license_plate_score?: number;
    [key: string]: unknown;
  };
};

/** Everything Explore can filter on. The URL holds this under the same names. */
export type ExploreFilter = {
  query?: string;
  cameras?: string[];
  labels?: string[];
  sub_labels?: string[];
  attributes?: string[];
  recognized_license_plate?: string[];
  zones?: string[];
  before?: number;
  after?: number;
  time_range?: string;
  search_type?: SearchSource[];
  min_score?: number;
  max_score?: number;
  min_speed?: number;
  max_speed?: number;
  has_snapshot?: number;
  has_clip?: number;
  is_submitted?: number;
  event_id?: string;
  sort?: SearchSort;
};

export type SavedSearch = {
  name: string;
  search: string;
  filter: ExploreFilter | undefined;
};

export type ExploreView = "summary" | "grid";

export type ExploreRequest = {
  path: "events" | "events/search";
  params: Record<string, string | number>;
};

export type LifecycleClass =
  | "visible"
  | "entered_zone"
  | "attribute"
  | "active"
  | "stationary"
  | "gone"
  | "heard"
  | "external"
  | "path_point";

export type TimelineEntry = {
  camera: string;
  timestamp: number;
  source: string;
  source_id: string;
  class_type: LifecycleClass;
  data: {
    camera: string;
    label: string;
    sub_label?: string | null;
    box?: [number, number, number, number];
    region?: [number, number, number, number];
    attribute?: string;
    attribute_box?: [number, number, number, number];
    zones: string[];
    score?: number;
    computed_score?: number | null;
    top_score?: number | null;
    ratio?: number;
    area?: number;
  };
};

export type ModelState =
  | "not_downloaded"
  | "downloading"
  | "downloaded"
  | "error"
  | "training"
  | "complete"
  | "failed";

export type EmbeddingsReindexProgress = {
  thumbnails: number;
  descriptions: number;
  processed_objects: number;
  total_objects: number;
  time_remaining: number | null;
  status?: string;
};

export type TrackedObjectUpdate = {
  type: "description" | "lpr" | "transcription" | "face" | string;
  id: string;
  camera: string;
  description?: string;
};
