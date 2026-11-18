/** Paged tracked object results for the current Explore request. */
import { computed, shallowRef, watch, type Ref } from "vue";
import { http } from "@/api/http";
import type { ExploreRequest, TrackedEvent } from "@/types/event";
import {
  EXPLORE_PAGE_SIZE,
  canLoadMore,
  pageParams,
  uniqueEvents,
} from "@/utils/explore";

export function useExploreResults(request: Ref<ExploreRequest | null>) {
  const items = shallowRef<TrackedEvent[]>([]);
  const error = shallowRef<unknown>();
  const hasLoaded = shallowRef(false);
  const isValidating = shallowRef(false);
  const isLoadingMore = shallowRef(false);
  const hasMore = shallowRef(false);

  // every new request bumps this, so answers to older ones are dropped
  let generation = 0;

  const key = computed(() =>
    request.value ? JSON.stringify(request.value) : null,
  );

  function fetchPage(current: ExploreRequest, loaded?: TrackedEvent[]) {
    return http.get<TrackedEvent[]>(current.path, {
      params: pageParams(current, loaded),
    });
  }

  async function loadFirst(reset: boolean) {
    const current = request.value;
    if (reset) generation++;
    const token = generation;
    if (!current) {
      items.value = [];
      hasMore.value = false;
      error.value = undefined;
      hasLoaded.value = false;
      isValidating.value = false;
      return;
    }
    isValidating.value = true;
    try {
      const page = await fetchPage(current);
      if (token !== generation) return;
      if (reset) {
        items.value = uniqueEvents(page);
        hasMore.value = canLoadMore(current, page.length, page.length);
      } else {
        // a refresh only replaces the rows the first page covers, the deeper
        // pages stay loaded so the scroll position survives
        const rest = items.value.slice(EXPLORE_PAGE_SIZE);
        items.value = uniqueEvents([...page, ...rest]);
        if (!rest.length)
          hasMore.value = canLoadMore(current, page.length, page.length);
      }
      error.value = undefined;
      hasLoaded.value = true;
    } catch (err) {
      if (token !== generation) return;
      error.value = err;
      hasLoaded.value = true;
      if (reset) {
        items.value = [];
        hasMore.value = false;
      }
    } finally {
      if (token === generation) isValidating.value = false;
    }
  }

  watch(key, () => void loadFirst(true), { immediate: true });

  async function loadMore() {
    const current = request.value;
    if (!current || !hasMore.value) return;
    if (isLoadingMore.value || isValidating.value) return;
    const token = generation;
    isLoadingMore.value = true;
    try {
      const page = await fetchPage(current, items.value);
      if (token !== generation) return;
      items.value = uniqueEvents([...items.value, ...page]);
      hasMore.value = canLoadMore(current, page.length, items.value.length);
    } catch (err) {
      if (token !== generation) return;
      error.value = err;
      hasMore.value = false;
    } finally {
      isLoadingMore.value = false;
    }
  }

  function remove(ids: readonly string[]) {
    const gone = new Set(ids);
    items.value = items.value.filter((event) => !gone.has(event.id));
  }

  function patch(id: string, change: (event: TrackedEvent) => TrackedEvent) {
    items.value = items.value.map((event) =>
      event.id === id ? change(event) : event,
    );
  }

  return {
    items,
    error,
    hasLoaded,
    isValidating,
    isLoadingMore,
    hasMore,
    loadMore,
    remove,
    patch,
    refresh: () => loadFirst(false),
  };
}
