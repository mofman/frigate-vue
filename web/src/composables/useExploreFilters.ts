/** Explore's filter and open object, both kept in the URL. */
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { ExploreFilter } from "@/types/event";
import {
  hasExploreFilter,
  isSimilaritySearch,
  parseExploreFilter,
  serializeExploreFilter,
} from "@/utils/explore";

export function useExploreFilters() {
  const route = useRoute();
  const router = useRouter();

  // the shared route changes before this page unmounts, so hold the last value
  // instead of briefly reading another page's query
  const query = computed<typeof route.query>((previous) =>
    route.name === "explore" ? route.query : (previous ?? {}),
  );

  const filter = computed(() => parseExploreFilter(query.value));
  const hasFilter = computed(() => hasExploreFilter(filter.value));
  const similarity = computed(() => isSimilaritySearch(filter.value));
  const openId = computed(() =>
    typeof query.value.id === "string" ? query.value.id : undefined,
  );

  /** Replace the whole filter. Back returns to the previous one. */
  function setFilter(next: ExploreFilter) {
    return router.push({ query: serializeExploreFilter(next) });
  }

  function updateFilter(patch: Partial<ExploreFilter>) {
    return setFilter({ ...filter.value, ...patch });
  }

  function findSimilar(id: string) {
    const { query: _query, ...rest } = filter.value;
    return setFilter({
      ...rest,
      search_type: ["similarity"],
      event_id: id,
      sort: undefined,
    });
  }

  let pushedOpen = false;

  function withOpenId(id: string | undefined) {
    const { id: _id, ...rest } = query.value;
    return id ? { ...rest, id } : rest;
  }

  /** Show an object. Back closes it, moving between objects does not stack. */
  function openObject(id: string) {
    if (openId.value) return router.replace({ query: withOpenId(id) });
    pushedOpen = true;
    return router.push({ query: withOpenId(id) });
  }

  function closeObject() {
    if (!openId.value) return;
    if (pushedOpen) {
      pushedOpen = false;
      router.back();
    } else {
      // arrived by link, so there may be nothing of ours to go back to
      void router.replace({ query: withOpenId(undefined) });
    }
  }

  return {
    filter,
    hasFilter,
    similarity,
    openId,
    setFilter,
    updateFilter,
    findSimilar,
    openObject,
    closeObject,
  };
}
