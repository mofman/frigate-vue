/**
 * Small stale-while-revalidate cache for GET requests.
 *
 * Unlike SWR's default, a key change keeps showing the previous data until the
 * new key resolves. Views never flash empty or skeleton states while a time
 * window or filter moves.
 */
import {
  computed,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";
import { http, type QueryParams } from "./http";

export type QueryKey = string | readonly [string, QueryParams?];

type Entry = {
  data: unknown;
  error: unknown;
  updatedAt: number;
  inflight?: Promise<unknown>;
  listeners: Set<() => void>;
};

const cache = new Map<string, Entry>();

function serialize(key: QueryKey): string {
  if (typeof key === "string") return key;
  const [path, params] = key;
  if (!params) return path;
  const sorted = Object.keys(params)
    .sort()
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return `${path}?${sorted}`;
}

function entryFor(id: string): Entry {
  let entry = cache.get(id);
  if (!entry) {
    entry = {
      data: undefined,
      error: undefined,
      updatedAt: 0,
      listeners: new Set(),
    };
    cache.set(id, entry);
  }
  return entry;
}

function notify(entry: Entry) {
  for (const listener of Array.from(entry.listeners)) listener();
}

async function load(id: string, key: QueryKey): Promise<unknown> {
  const entry = entryFor(id);
  if (entry.inflight) return entry.inflight;

  const [path, params] = typeof key === "string" ? [key, undefined] : key;
  entry.inflight = http
    .get<unknown>(path, { params })
    .then((data) => {
      entry.data = data;
      entry.error = undefined;
      entry.updatedAt = Date.now();
      return data;
    })
    .catch((error: unknown) => {
      entry.error = error;
      throw error;
    })
    .finally(() => {
      entry.inflight = undefined;
      notify(entry);
    });

  return entry.inflight;
}

/** Re-fetch every active query whose path starts with the prefix. */
export function invalidate(prefix: string) {
  for (const [id, entry] of cache) {
    if (id.startsWith(prefix) && entry.listeners.size > 0) {
      entry.updatedAt = 0;
      notify(entry);
    }
  }
}

/** Write data into the cache, eg after an optimistic mutation. */
export function mutate<T>(
  key: QueryKey,
  update: (current: T | undefined) => T,
) {
  const entry = entryFor(serialize(key));
  entry.data = update(entry.data as T | undefined);
  notify(entry);
}

export type QueryOptions = {
  /** milliseconds between background refreshes */
  refreshInterval?: number;
  /** data younger than this is served without a refetch */
  staleTime?: number;
  revalidateOnFocus?: boolean;
};

export type QueryResult<T> = {
  data: Ref<T | undefined>;
  error: Ref<unknown>;
  /** true only when there is nothing to show yet */
  isLoading: Ref<boolean>;
  /** true while any request for the current key is in flight */
  isValidating: Ref<boolean>;
  refresh: () => Promise<void>;
};

export function useQuery<T>(
  key: MaybeRefOrGetter<QueryKey | null | undefined>,
  options: QueryOptions = {},
): QueryResult<T> {
  const {
    refreshInterval,
    staleTime = 2000,
    revalidateOnFocus = true,
  } = options;
  const data = shallowRef<T | undefined>();
  const error = shallowRef<unknown>();
  const isValidating = shallowRef(false);
  const hasData = computed(() => data.value !== undefined);

  let currentId: string | null = null;
  let currentKey: QueryKey | null = null;
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const sync = () => {
    if (!currentId) return;
    const entry = entryFor(currentId);
    if (entry.data !== undefined) data.value = entry.data as T;
    error.value = entry.error;
    isValidating.value = entry.inflight !== undefined;
    if (entry.updatedAt === 0 && !entry.inflight && currentKey) {
      void revalidate();
    }
  };

  const revalidate = async () => {
    if (!currentId || !currentKey) return;
    isValidating.value = true;
    try {
      await load(currentId, currentKey);
    } catch {
      // surfaced through error ref by sync()
    }
  };

  const onFocus = () => {
    if (document.visibilityState === "visible") void revalidate();
  };

  watch(
    () => {
      const value = toValue(key);
      return value ? serialize(value) : null;
    },
    (id) => {
      unsubscribe?.();
      unsubscribe = null;
      clearInterval(timer);
      currentId = id;
      currentKey = id ? (toValue(key) as QueryKey) : null;
      if (!id) return;

      const entry = entryFor(id);
      entry.listeners.add(sync);
      unsubscribe = () => entry.listeners.delete(sync);

      // cached data for the new key replaces the old immediately; otherwise
      // the previous key's data stays visible until this one resolves
      if (entry.data !== undefined) data.value = entry.data as T;
      error.value = entry.error;

      if (Date.now() - entry.updatedAt > staleTime) void revalidate();
      if (refreshInterval) {
        timer = setInterval(() => {
          if (document.visibilityState === "visible") void revalidate();
        }, refreshInterval);
      }
    },
    { immediate: true },
  );

  if (revalidateOnFocus) {
    document.addEventListener("visibilitychange", onFocus);
  }

  onScopeDispose(() => {
    unsubscribe?.();
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onFocus);
  });

  return {
    data,
    error,
    isLoading: computed(() => !hasData.value && error.value === undefined),
    isValidating,
    refresh: revalidate,
  };
}

export const __test = { serialize, cache };
