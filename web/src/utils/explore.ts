/** Pure helpers for Explore: URL state, request building, paging and media. */
import { apiBase } from "@/api/http";
import type {
  ExploreFilter,
  ExploreRequest,
  ExploreView,
  SearchSort,
  SearchSource,
  TrackedEvent,
} from "@/types/event";

export const EXPLORE_PAGE_SIZE = 25;
/** events/search never returns more than this many matches */
export const SEARCH_RESULT_LIMIT = 100;

const LIST_KEYS = [
  "cameras",
  "labels",
  "sub_labels",
  "attributes",
  "recognized_license_plate",
  "zones",
] as const;
const NUMBER_KEYS = [
  "before",
  "after",
  "min_score",
  "max_score",
  "min_speed",
  "max_speed",
  "has_snapshot",
  "has_clip",
  "is_submitted",
] as const;

type RawQuery = Record<string, unknown>;

function single(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === "string" && first !== "" ? first : undefined;
}

/** Read a filter from route query values. Unknown keys are ignored. */
export function parseExploreFilter(query: RawQuery): ExploreFilter {
  const filter: ExploreFilter = {};
  for (const key of LIST_KEYS) {
    const value = single(query[key]);
    if (value) filter[key] = value.split(",").filter(Boolean);
  }
  for (const key of NUMBER_KEYS) {
    const value = Number(single(query[key]));
    if (single(query[key]) !== undefined && Number.isFinite(value))
      filter[key] = value;
  }
  const text = single(query.query);
  if (text) filter.query = text;
  const timeRange = single(query.time_range);
  if (timeRange) filter.time_range = timeRange;
  const eventId = single(query.event_id);
  if (eventId) filter.event_id = eventId;
  const sort = single(query.sort);
  if (sort) filter.sort = sort as SearchSort;
  const searchType = single(query.search_type);
  if (searchType) filter.search_type = searchType.split(",") as SearchSource[];
  return filter;
}

/** Route query for a filter. Empty values are left out. */
export function serializeExploreFilter(
  filter: ExploreFilter,
): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) query[key] = value.join(",");
    } else {
      query[key] = String(value);
    }
  }
  return query;
}

export function hasExploreFilter(filter: ExploreFilter) {
  return Object.keys(serializeExploreFilter(filter)).length > 0;
}

export function isSimilaritySearch(filter: ExploreFilter) {
  return filter.search_type?.join(",") === "similarity";
}

/** Which list to load for a filter, or null when the summary is shown. */
export function exploreRequest(
  filter: ExploreFilter,
  { timezone, defaultView }: { timezone: string; defaultView: ExploreView },
): ExploreRequest | null {
  if (!hasExploreFilter(filter) && defaultView === "summary") return null;

  const { query, search_type: _searchType, ...rest } = filter;
  const params: ExploreRequest["params"] = {
    ...serializeExploreFilter(rest),
    timezone,
    include_thumbnails: 0,
  };
  const similarity = isSimilaritySearch(filter);
  if (!query && !similarity) return { path: "events", params };

  if (query && !similarity) params.query = query;
  if (filter.search_type?.length)
    params.search_type = filter.search_type.join(",");
  return { path: "events/search", params };
}

/** Rows are ordered by start time, so a start time cursor is safe. */
export function usesDateCursor({ path, params }: ExploreRequest) {
  return (
    params.sort === "date_asc" ||
    params.sort === "date_desc" ||
    (!params.sort && path === "events")
  );
}

/** Params for the first page, or the page after `loaded` rows. */
export function pageParams(
  request: ExploreRequest,
  loaded: readonly TrackedEvent[] = [],
): ExploreRequest["params"] {
  const params = { ...request.params, limit: EXPLORE_PAGE_SIZE };
  const last = loaded.at(-1);
  if (!last) return params;
  if (!usesDateCursor(request)) return { ...params, offset: loaded.length };
  return {
    ...params,
    [request.params.sort === "date_asc" ? "after" : "before"]: last.start_time,
  };
}

/** Whether another page may exist after the newest response. */
export function canLoadMore(
  request: ExploreRequest,
  lastPageSize: number,
  total: number,
) {
  if (lastPageSize < EXPLORE_PAGE_SIZE) return false;
  return request.path !== "events/search" || total < SEARCH_RESULT_LIMIT;
}

/** Keep the first copy of each event, since pages can overlap. */
export function uniqueEvents(events: readonly TrackedEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

/** Match strength in percent for a result's search distance. */
export function searchConfidence(distance: number, similarity: boolean) {
  // similarity distances are cosine, the others are normalized z scores
  const confidence = similarity ? 1 - distance : 1 / (1 + Math.exp(distance));
  return Math.round(confidence * 100);
}

/** Sort choices that apply to the current filter. */
export function sortOptions(filter: ExploreFilter): SearchSort[] {
  const options: SearchSort[] = [
    "date_desc",
    "date_asc",
    "score_desc",
    "score_asc",
  ];
  if (filter.min_speed !== undefined || filter.max_speed !== undefined)
    options.push("speed_desc", "speed_asc");
  if (filter.query || filter.event_id) options.push("relevance");
  return options;
}

export function eventScore(event: TrackedEvent) {
  return event.data.score ?? event.data.top_score ?? event.top_score ?? 0;
}

export function eventTopScore(event: TrackedEvent) {
  return event.data.top_score ?? event.top_score ?? event.data.score ?? 0;
}

/** i18n key for an event's label, audio labels have their own file. */
export function eventLabelKey(event: Pick<TrackedEvent, "label" | "data">) {
  return `${event.data.type === "audio" ? "audio" : "objects"}:${event.label}`;
}

/** `yyyy-mm-dd` in local time, for a date input. */
export function dateInputValue(seconds: number | undefined) {
  if (seconds === undefined) return "";
  const date = new Date(seconds * 1000);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Seconds at the start of a date input's day, local time. */
export function startOfDateInput(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(year, month - 1, day).getTime() / 1000;
}

/** Seconds at the very end of a date input's day, local time. */
export function endOfDateInput(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(year, month - 1, day + 1).getTime() / 1000 - 0.001;
}

/**
 * Some shared translations contain simple markup. Show them as text, which
 * keeps every language without ever rendering a translation as HTML.
 */
export function plainText(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

export function downloadFile(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

/** True when keys typed at this element belong to it, not to the page. */
export function isTextEntry(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT", "VIDEO"].includes(target.tagName))
  );
}

function eventPath(event: Pick<TrackedEvent, "id">, file: string) {
  return `${apiBase}events/${encodeURIComponent(event.id)}/${file}`;
}

export const eventThumbnail = (event: Pick<TrackedEvent, "id">) =>
  eventPath(event, "thumbnail.webp");
export const eventSnapshot = (event: Pick<TrackedEvent, "id">) =>
  eventPath(event, "snapshot.jpg?crop=0&bbox=1&timestamp=0");
export const eventCleanSnapshot = (event: Pick<TrackedEvent, "id">) =>
  eventPath(event, "snapshot-clean.webp");
export const eventClip = (event: Pick<TrackedEvent, "id">) =>
  eventPath(event, "clip.mp4");
