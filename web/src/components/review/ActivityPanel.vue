<script setup lang="ts">
/** Recent unreviewed activity next to the camera grid. */
import { computed, shallowRef } from "vue";
import { ArrowRight } from "@lucide/vue";
import { useRouter } from "vue-router";
import { useQuery } from "@/api/query";
import { onWsMessage } from "@/api/ws";
import { useT } from "@/composables/useT";
import { useConfig } from "@/composables/useFrigate";
import ReviewFilter, { type ReviewFilterValue } from "./ReviewFilter.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import type { ReviewSegment } from "@/types/frigate";
import { markReviewed, reviewStart } from "@/utils/review";
import ActivityItem from "./ActivityItem.vue";

const props = defineProps<{ cameras: string[] }>();
const { t } = useT(["views/app"]);
const router = useRouter();

const { data: config } = useConfig();
const filter = shallowRef<ReviewFilterValue>({
  severity: "all",
  labels: [],
  zones: [],
});
const labels = computed(() => [
  ...new Set(
    props.cameras.flatMap(
      (name) => config.value?.cameras[name]?.objects?.track ?? [],
    ),
  ),
]);

const key = computed(() =>
  props.cameras.length
    ? ([
        "review",
        {
          limit: 20,
          reviewed: 0,
          cameras: props.cameras.join(","),
          severity:
            filter.value.severity === "all" ? undefined : filter.value.severity,
          labels: filter.value.labels.join(",") || undefined,
        },
      ] as const)
    : null,
);
const { data: reviews, refresh } = useQuery<ReviewSegment[]>(key, {
  staleTime: 10_000,
});
onWsMessage("reviews", () => void refresh());

function open(review: ReviewSegment) {
  void markReviewed([review.id]).then(() => refresh());
  void router.push({
    name: "camera",
    params: { name: review.camera },
    query: { t: Math.floor(reviewStart(review)) },
  });
}
</script>

<template>
  <aside class="activity-panel">
    <div class="activity-panel__header">
      <h2 class="activity-panel__title">{{ t("dashboard.recentActivity") }}</h2>
      <ReviewFilter v-model="filter" :labels="labels" :zones="[]" size="sm" />
    </div>
    <div class="activity-panel__list">
      <ActivityItem
        v-for="review in reviews ?? []"
        :key="review.id"
        :review="review"
        @click="open(review)"
      />
      <EmptyState
        v-if="reviews && !reviews.length"
        :title="t('dashboard.allCaughtUp')"
      />
    </div>
    <RouterLink to="/review" class="activity-panel__all">
      {{ t("dashboard.viewAll") }}
      <ArrowRight :size="14" aria-hidden="true" />
    </RouterLink>
  </aside>
</template>

<style scoped>
@property --fade-end {
  syntax: "<length>";
  inherits: false;
  initial-value: 48px;
}

@keyframes activity-fade {
  90% {
    --fade-end: 48px;
  }

  to {
    --fade-end: 0px;
  }
}

.activity-panel {
  display: flex;
  flex-direction: column;
  min-block-size: 0;
  background: var(--bg-panel);
  border-inline-start: 1px solid var(--glass-border);
}

.activity-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
}

.activity-panel__title {
  font-size: var(--text-md);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.activity-panel__list {
  container: activity / size;
  flex: 1;
  min-block-size: 0;
  padding: 8px;
  overflow-y: auto;
}

.activity-panel__all {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 16px;
  border-block-start: 1px solid var(--glass-border);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--accent);
  transition:
    background var(--dur),
    color var(--dur);

  &:hover {
    background: var(--accent-surface);
    color: var(--accent-text-hover);
  }
}

@media (max-width: 1024px) {
  .activity-panel {
    order: -1;
    border-inline-start: none;
    border-block-end: 1px solid var(--glass-border);
    background: var(--bg-stage);
  }

  .activity-panel__header,
  .activity-panel__all {
    display: none;
  }

  .activity-panel__list {
    display: flex;
    gap: 10px;
    flex: none;
    block-size: calc(clamp(150px, 22vw, 220px) * 9 / 16 + 24px);
    /* same gutter and gap as the camera grid below, so edges line up */
    padding: 12px;
    gap: 12px;
    scroll-padding-inline: 12px;
    scroll-snap-type: x mandatory;
    overflow-x: auto;
    overflow-y: hidden;
    /* fade the right edge to hint at more, clearing once scrolled to the end */
    mask-image: linear-gradient(
      to left,
      transparent,
      var(--bg-media) var(--fade-end)
    );

    @supports (animation-timeline: scroll()) {
      animation: activity-fade linear both;
      animation-timeline: scroll(self inline);
    }
  }

  .activity-panel__list :deep(.empty-state) {
    padding: 8px;
  }
}

@media (max-width: 768px) {
  .activity-panel__list {
    block-size: calc(clamp(150px, 22vw, 220px) * 9 / 16 + 20px);
    padding: 10px;
    gap: 8px;
    scroll-padding-inline: 10px;
  }
}
</style>
