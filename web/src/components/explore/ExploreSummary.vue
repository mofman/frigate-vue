<script setup lang="ts">
/** Landing view: the most recent tracked objects for each label. */
import { computed } from "vue";
import { ChevronRight } from "@lucide/vue";
import { useT } from "@/composables/useT";
import type { TrackedEvent } from "@/types/event";
import { eventLabelKey } from "@/utils/explore";
import ExploreCard from "./ExploreCard.vue";

const props = defineProps<{
  events: TrackedEvent[];
  selected: ReadonlySet<string>;
  flashId?: string;
}>();
const emit = defineEmits<{
  open: [event: TrackedEvent];
  toggleSelect: [event: TrackedEvent];
}>();
defineSlots<{ actions(props: { event: TrackedEvent }): unknown }>();

const { t } = useT(["views/explore", "objects", "audio"]);

const rows = computed(() => {
  const byLabel = new Map<string, TrackedEvent[]>();
  for (const event of props.events) {
    const row = byLabel.get(event.label);
    if (row) row.push(event);
    else byLabel.set(event.label, [event]);
  }
  return [...byLabel].map(([label, events]) => {
    const first = events[0]!;
    return {
      label,
      events,
      count: first.event_count ?? events.length,
      name: t(eventLabelKey(first), {
        defaultValue: label.replaceAll("_", " "),
      }),
    };
  });
});
</script>

<template>
  <div class="explore-summary">
    <section v-for="row in rows" :key="row.label" class="explore-summary__row">
      <header class="explore-summary__head">
        <h2>{{ row.name }}</h2>
        <span>{{ t("trackedObjectsCount", { count: row.count }) }}</span>
        <RouterLink
          class="explore-summary__more"
          :to="{ name: 'explore', query: { labels: row.label } }"
          :aria-label="t('exploreMore', { label: row.name })"
          :title="t('exploreMore', { label: row.name })"
        >
          <ChevronRight :size="18" aria-hidden="true" />
        </RouterLink>
      </header>
      <div class="explore-summary__cards">
        <ExploreCard
          v-for="event in row.events"
          :key="event.id"
          :event="event"
          :selected="selected.has(event.id)"
          :flash="flashId === event.id"
          @open="emit('open', event)"
          @toggle-select="emit('toggleSelect', event)"
        >
          <template #actions>
            <slot name="actions" :event="event" />
          </template>
        </ExploreCard>
      </div>
    </section>
  </div>
</template>

<style scoped>
.explore-summary {
  display: grid;
  gap: 24px;
}

.explore-summary__row {
  min-inline-size: 0;
}

.explore-summary__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-block-end: 10px;
  color: var(--text-tertiary);
  font-size: var(--text-sm);

  h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: var(--text-base);
    font-weight: 600;
    text-transform: capitalize;
  }
}

.explore-summary__more {
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  margin-inline-start: auto;
  border-radius: var(--radius-xs);
  color: var(--text-secondary);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.explore-summary__cards {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(170px, calc((100% - 72px) / 10));
  gap: 8px;
  padding-block-end: 6px;
  overflow-x: auto;
  scroll-snap-type: x proximity;

  > * {
    scroll-snap-align: start;
  }
}

@media (max-width: 768px) {
  .explore-summary__cards {
    grid-auto-columns: 42%;
  }
}
</style>
