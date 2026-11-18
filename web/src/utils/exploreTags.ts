/** The `key:value` filter syntax of Explore's search box. */
import type { ExploreFilter, SearchSource } from "@/types/event";

export const TAG_KEYS = [
  "cameras",
  "labels",
  "zones",
  "sub_labels",
  "attributes",
  "search_type",
  "time_range",
  "before",
  "after",
  "min_score",
  "max_score",
  "min_speed",
  "max_speed",
  "recognized_license_plate",
  "has_clip",
  "has_snapshot",
  "is_submitted",
] as const;
export type TagKey = (typeof TAG_KEYS)[number];

export type TagSuggestions = Partial<Record<TagKey, string[]>>;
export type DateOrder = "DMY" | "MDY" | "YMD";

export type TagContext = {
  suggestions: TagSuggestions;
  hour12: boolean;
  dateOrder: DateOrder;
};

export type TagResult =
  | { filter: ExploreFilter }
  /** last part of a filter.toast.error key */
  | { error: string }
  /** the value is not valid for this key */
  | null;

const LIST_KEYS = [
  "cameras",
  "labels",
  "zones",
  "sub_labels",
  "attributes",
  "recognized_license_plate",
] as const;
type ListKey = (typeof LIST_KEYS)[number];
const isListKey = (key: TagKey): key is ListKey =>
  (LIST_KEYS as readonly string[]).includes(key);

export function isTagKey(key: string, context: TagContext): key is TagKey {
  return key in context.suggestions;
}

/** Order of day, month and year in the browser's own date format. */
export function localDateOrder(locale?: string): DateOrder {
  const order = new Intl.DateTimeFormat(locale)
    .formatToParts(new Date(2024, 11, 25))
    .filter(({ type }) => ["day", "month", "year"].includes(type))
    .map(({ type }) => type[0]!.toUpperCase())
    .join("");
  return order === "DMY" || order === "YMD" ? order : "MDY";
}

/** Today (plus an offset) as the 8 digits the date filters accept. */
export function dateTagValue(
  order: DateOrder,
  daysOffset = 0,
  now = new Date(),
) {
  const date = new Date(now);
  date.setDate(date.getDate() + daysOffset);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  if (order === "DMY") return `${day}${month}${year}`;
  if (order === "YMD") return `${year}${month}${day}`;
  return `${month}${day}${year}`;
}

/** Local midnight in seconds for an 8 digit date, or undefined if invalid. */
export function parseTagDate(value: string, order: DateOrder) {
  if (!/^\d{8}$/.test(value)) return undefined;
  const parts =
    order === "YMD"
      ? [value.slice(0, 4), value.slice(4, 6), value.slice(6)]
      : order === "DMY"
        ? [value.slice(4), value.slice(2, 4), value.slice(0, 2)]
        : [value.slice(4), value.slice(0, 2), value.slice(2, 4)];
  const [year, month, day] = parts.map(Number) as [number, number, number];
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date.getTime() / 1000;
}

function parseTime(value: string, hour12: boolean) {
  if (!hour12) {
    return /^(?:([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(value)
      ? value
      : undefined;
  }
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)(A|P)M$/i.exec(value);
  if (!match) return undefined;
  let hours = Number(match[1]) % 12;
  if (match[3]!.toUpperCase() === "P") hours += 12;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

/** `start-end` in the display clock to the API's 24 hour `start,end`. */
export function parseTimeRange(value: string, hour12: boolean) {
  const parts = value.replace("-", ",").split(",");
  if (parts.length !== 2) return undefined;
  const start = parseTime(parts[0]!.trim(), hour12);
  const end = parseTime(parts[1]!.trim(), hour12);
  return start && end && start < end ? `${start},${end}` : undefined;
}

function inRange(value: string, min: number, max: number) {
  const number = Number(value);
  return value !== "" && number >= min && number <= max;
}

/** Add one `key:value` to a filter. The input filter is not changed. */
export function applyTag(
  filter: ExploreFilter,
  key: TagKey,
  rawValue: string,
  context: TagContext,
): TagResult {
  const value = rawValue.trim();
  if (!value) return null;
  const known = context.suggestions[key]?.includes(value) ?? false;

  switch (key) {
    case "before":
    case "after": {
      const start = parseTagDate(value, context.dateOrder);
      if (start === undefined) return null;
      if (key === "before") {
        if (filter.after !== undefined && start <= filter.after)
          return { error: "beforeDateBeLaterAfter" };
        // the day itself is excluded, as it always has been for typed dates
        return { filter: { ...filter, before: start - 0.001 } };
      }
      if (filter.before !== undefined && start >= filter.before)
        return { error: "afterDatebeEarlierBefore" };
      return { filter: { ...filter, after: start } };
    }
    case "time_range": {
      const range = parseTimeRange(value, context.hour12);
      return range ? { filter: { ...filter, time_range: range } } : null;
    }
    case "min_score":
    case "max_score": {
      if (!inRange(value, 50, 100)) return null;
      const score = parseInt(value, 10) / 100;
      if (
        key === "min_score" &&
        filter.max_score !== undefined &&
        score > filter.max_score
      )
        return { error: "minScoreMustBeLessOrEqualMaxScore" };
      if (
        key === "max_score" &&
        filter.min_score !== undefined &&
        score < filter.min_score
      )
        return { error: "maxScoreMustBeGreaterOrEqualMinScore" };
      return { filter: { ...filter, [key]: score } };
    }
    case "min_speed":
    case "max_speed": {
      if (!inRange(value, 1, 150)) return null;
      const speed = Number(value);
      if (
        key === "min_speed" &&
        filter.max_speed !== undefined &&
        speed > filter.max_speed
      )
        return { error: "minSpeedMustBeLessOrEqualMaxSpeed" };
      if (
        key === "max_speed" &&
        filter.min_speed !== undefined &&
        speed < filter.min_speed
      )
        return { error: "maxSpeedMustBeGreaterOrEqualMinSpeed" };
      return { filter: { ...filter, [key]: speed } };
    }
    case "has_clip":
    case "has_snapshot":
    case "is_submitted":
      if (!known) return null;
      return { filter: { ...filter, [key]: value === "yes" ? 1 : 0 } };
    case "search_type": {
      if (!known) return null;
      const current = filter.search_type ?? [];
      const source = value as SearchSource;
      return {
        filter: {
          ...filter,
          search_type: current.includes(source)
            ? current
            : [...current, source],
        },
      };
    }
    default: {
      if (!known) return null;
      const current = filter[key] ?? [];
      return {
        filter: {
          ...filter,
          [key]: current.includes(value) ? current : [...current, value],
        },
      };
    }
  }
}

export type ActiveTag = { key: TagKey; value: string | number };

/** One entry per value, for showing the active filters as removable chips. */
export function activeTags(filter: ExploreFilter): ActiveTag[] {
  const tags: ActiveTag[] = [];
  for (const key of TAG_KEYS) {
    const value = filter[key];
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      // a similarity search has its own indicator
      for (const item of value)
        if (item !== "similarity") tags.push({ key, value: item });
    } else {
      tags.push({ key, value });
    }
  }
  return tags;
}

export function removeTag(
  filter: ExploreFilter,
  { key, value }: ActiveTag,
): ExploreFilter {
  const next: ExploreFilter = { ...filter };
  if (isListKey(key) || key === "search_type") {
    const rest = ((filter[key] ?? []) as string[]).filter(
      (item) => item !== value,
    );
    if (rest.length) (next[key] as string[]) = rest;
    else delete next[key];
    return next;
  }
  delete next[key];
  // only snapshots can be submitted, so that filter cannot outlive this one
  if (key === "has_snapshot") delete next.is_submitted;
  return next;
}

/** The word being typed, and whether a separator has just ended it. */
export function currentWord(text: string) {
  const words = text.split(/[\s,]+/).filter(Boolean);
  return { word: words.at(-1) ?? "", ended: /[\s,]$/.test(text) };
}

export function splitTag(word: string) {
  const match = /^(\w+):(.*)$/.exec(word);
  return match ? { key: match[1]!, value: match[2]! } : undefined;
}

/** Text with its last word removed, leaving the search query. */
export function withoutLastWord(text: string) {
  const { word } = currentWord(text);
  const index = text.lastIndexOf(word);
  if (!word || index === -1) return text.trim();
  return text
    .slice(0, index)
    .replace(/[\s,]+$/, "")
    .trim();
}

export type TagSuggestionList = {
  /** set when the list holds values for this key */
  key?: TagKey;
  items: string[];
};

/** What to offer for the current text. */
export function tagSuggestions(
  text: string,
  filter: ExploreFilter,
  context: TagContext,
  savedNames: readonly string[] = [],
): TagSuggestionList {
  const { word, ended } = currentWord(text);
  const prefix = ended ? "" : word.toLowerCase();
  const tag = ended ? undefined : splitTag(word);

  if (tag && isTagKey(tag.key, context)) {
    const key = tag.key;
    const current = filter[key];
    const used = Array.isArray(current) ? (current as string[]) : [];
    const value = tag.value.toLowerCase();
    return {
      key,
      items: (context.suggestions[key] ?? []).filter(
        (item) => item.toLowerCase().startsWith(value) && !used.includes(item),
      ),
    };
  }

  const keys = (Object.keys(context.suggestions) as TagKey[]).filter((key) => {
    const current = filter[key];
    if (current === undefined) return true;
    return (
      Array.isArray(current) &&
      current.length < (context.suggestions[key]?.length ?? 0)
    );
  });
  return {
    items: [...savedNames, ...keys].filter((item) =>
      item.toLowerCase().startsWith(prefix),
    ),
  };
}
