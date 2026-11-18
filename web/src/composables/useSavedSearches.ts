/**
 * Named Explore searches, kept per user in this browser. They use the storage
 * key of the previous interface, so searches saved there are still here.
 */
import { get, set } from "idb-keyval";
import { computed, shallowRef, watch } from "vue";
import { useProfile } from "@/composables/useFrigate";
import type { ExploreFilter, SavedSearch } from "@/types/event";
import { parseExploreFilter, serializeExploreFilter } from "@/utils/explore";

const BASE_KEY = "frigate-search-history";

export function useSavedSearches() {
  const { data: profile } = useProfile();
  const searches = shallowRef<SavedSearch[]>([]);
  const loaded = shallowRef(false);

  const key = computed(() => {
    const name = profile.value?.username;
    if (!profile.value) return undefined;
    return name && name !== "anonymous" ? `${BASE_KEY}:${name}` : BASE_KEY;
  });

  watch(
    key,
    async (storageKey) => {
      if (!storageKey) return;
      try {
        const stored =
          (await get<SavedSearch[]>(storageKey)) ??
          (await get<SavedSearch[]>(BASE_KEY));
        searches.value = (stored ?? []).map((item) => ({
          ...item,
          // older entries can hold single values wrapped in arrays
          filter: parseExploreFilter(serializeExploreFilter(item.filter ?? {})),
        }));
      } catch {
        // storage is unavailable, eg a private window
        searches.value = [];
      }
      loaded.value = true;
    },
    { immediate: true },
  );

  async function persist(next: SavedSearch[]) {
    searches.value = next;
    if (!key.value) return;
    try {
      await set(
        key.value,
        next.map((item) => ({ ...item, filter: { ...item.filter } })),
      );
    } catch {
      // kept in memory for this visit
    }
  }

  function save(name: string, search: string, filter: ExploreFilter) {
    return persist([
      ...searches.value.filter((item) => item.name !== name),
      { name, search, filter },
    ]);
  }

  function remove(name: string) {
    return persist(searches.value.filter((item) => item.name !== name));
  }

  return { searches, loaded, save, remove };
}
