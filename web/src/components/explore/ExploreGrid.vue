<script setup lang="ts">
/** Result grid with selection, match badges and infinite scroll. */
import { nextTick, onBeforeUnmount, shallowRef, watch } from "vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import { useT } from "@/composables/useT";
import { useMediaQuery } from "@/composables/useUtil";
import type { TrackedEvent } from "@/types/event";
import { searchConfidence } from "@/utils/explore";
import ExploreCard from "./ExploreCard.vue";

const props = defineProps<{
  items: TrackedEvent[];
  selected: ReadonlySet<string>;
  columns: number;
  /** explain matches on each card */
  showMatches: boolean;
  similarity: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  scroller: HTMLElement | null;
  /** keep this card in view */
  focusId?: string;
  flashId?: string;
}>();
const emit = defineEmits<{
  open: [event: TrackedEvent];
  toggleSelect: [event: TrackedEvent];
  loadMore: [];
}>();
defineSlots<{ actions(props: { event: TrackedEvent }): unknown }>();

const { t } = useT(["views/explore", "views/search"]);
const phone = useMediaQuery("(max-width: 768px)");
const root = shallowRef<HTMLElement | null>(null);
const sentinel = shallowRef<HTMLElement | null>(null);

function matchText(event: TrackedEvent) {
  if (!props.showMatches || event.search_distance === undefined) return "";
  return t("searchResult.tooltip", {
    type: t(`views/search:filter.searchType.${event.search_source}`, {
      defaultValue: event.search_source,
    }),
    confidence: searchConfidence(event.search_distance, props.similarity),
  });
}

let observer: IntersectionObserver | undefined;

function observe() {
  observer?.disconnect();
  observer = undefined;
  if (!sentinel.value) return;
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) emit("loadMore");
    },
    {
      // phones scroll the document, larger screens scroll the results pane
      root: phone.value ? null : props.scroller,
      rootMargin: "600px",
    },
  );
  observer.observe(sentinel.value);
}

// an observer only reports changes, so check again after each page in case
// the sentinel is still on screen
watch(
  [sentinel, phone, () => props.scroller, () => props.loadingMore],
  ([, , , loading]) => {
    if (!loading) observe();
  },
  { immediate: true, flush: "post" },
);
onBeforeUnmount(() => observer?.disconnect());

watch(
  () => props.focusId,
  async (id) => {
    if (!id) return;
    await nextTick();
    root.value
      ?.querySelector(`[data-event-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  },
);
</script>

<template>
  <div ref="root">
    <div class="explore-grid" :style="{ '--columns': columns }">
      <ExploreCard
        v-for="event in items"
        :key="event.id"
        :event="event"
        :selected="selected.has(event.id)"
        :flash="flashId === event.id"
        :match="matchText(event)"
        @open="emit('open', event)"
        @toggle-select="emit('toggleSelect', event)"
      >
        <template #actions>
          <slot name="actions" :event="event" />
        </template>
      </ExploreCard>
    </div>
    <div v-if="hasMore" ref="sentinel" class="explore-grid__more">
      <LoadingSpinner v-if="loadingMore" :delay="0" />
    </div>
  </div>
</template>

<style scoped>
.explore-grid {
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  gap: 10px;
}

.explore-grid__more {
  display: grid;
  place-items: center;
  min-block-size: 56px;
}

@media (max-width: 768px) {
  .explore-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
}

@media (min-width: 769px) and (max-width: 1100px) {
  .explore-grid {
    grid-template-columns: repeat(min(var(--columns), 4), minmax(0, 1fr));
  }
}
</style>
