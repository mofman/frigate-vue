<script setup lang="ts">
/** Alerts and detections to review, newest first, grouped by day. */
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";
import { CheckCheck } from "@lucide/vue";
import PageHeader from "@/components/layout/PageHeader.vue";
import CameraFilter from "@/components/review/CameraFilter.vue";
import ReviewCard from "@/components/review/ReviewCard.vue";
import SeverityTabs from "@/components/review/SeverityTabs.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import IconButton from "@/components/ui/IconButton.vue";
import SkeletonBlock from "@/components/ui/SkeletonBlock.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import { invalidate, mutate, useQuery } from "@/api/query";
import { onWsMessage } from "@/api/ws";
import { useCameras, useConfig } from "@/composables/useFrigate";
import { usePersistedRef } from "@/composables/useUtil";
import { useT } from "@/composables/useT";
import type {
  ReviewSegment,
  ReviewSeverity,
  ReviewSummary,
} from "@/types/frigate";
import { dayKey, formatDay, resolveTimezone } from "@/utils/time";
import { markReviewed, reviewStart } from "@/utils/review";

const PAGE = 48;

const { t } = useT(["views/app", "views/events"]);
const router = useRouter();
const cameras = useCameras();
const { data: config } = useConfig();
const timezone = computed(() => resolveTimezone(config.value?.ui?.timezone));

const severity = usePersistedRef<ReviewSeverity>("review-severity", "alert");
const selectedCameras = usePersistedRef<string[]>("review-cameras", []);
const showReviewed = usePersistedRef("review-show-reviewed", false);
const limit = shallowRef(PAGE);

const cameraParam = computed(() =>
  selectedCameras.value.length
    ? selectedCameras.value.join(",")
    : cameras.value.map((c) => c.name).join(","),
);

const listKey = computed(() =>
  cameraParam.value
    ? ([
        "review",
        {
          cameras: cameraParam.value,
          severity: severity.value,
          limit: limit.value,
          reviewed: showReviewed.value ? undefined : 0,
        },
      ] as const)
    : null,
);
const {
  data: reviews,
  isLoading,
  isValidating,
  refresh,
} = useQuery<ReviewSegment[]>(listKey, {
  staleTime: 10_000,
});

const summaryKey = computed(() =>
  cameraParam.value
    ? ([
        "review/summary",
        { cameras: cameraParam.value, timezone: timezone.value },
      ] as const)
    : null,
);
const { data: summary, refresh: refreshSummary } = useQuery<
  ReviewSummary & { last24Hours?: ReviewSummary[string] }
>(summaryKey, { staleTime: 30_000 });

onWsMessage("reviews", () => {
  void refresh();
  void refreshSummary();
});

watch([severity, selectedCameras, showReviewed], () => (limit.value = PAGE));

const counts = computed(() => {
  const day = summary.value?.last24Hours;
  if (!day) return {};
  return {
    alert: day.total_alert - day.reviewed_alert,
    detection: day.total_detection - day.reviewed_detection,
  };
});

const groups = computed(() => {
  const out: { key: string; label: string; items: ReviewSegment[] }[] = [];
  for (const review of reviews.value ?? []) {
    const key = dayKey(review.start_time, timezone.value);
    let group = out.at(-1);
    if (!group || group.key !== key) {
      group = {
        key,
        label: formatDay(review.start_time, { timezone: timezone.value }),
        items: [],
      };
      out.push(group);
    }
    group.items.push(review);
  }
  return out;
});

const hasMore = computed(() => (reviews.value?.length ?? 0) >= limit.value);

// infinite scroll
const sentinel = shallowRef<HTMLElement | null>(null);
let observer: IntersectionObserver | undefined;
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting && hasMore.value && !isValidating.value)
        limit.value += PAGE;
    },
    { rootMargin: "600px" },
  );
  watch(
    sentinel,
    (el, previous) => {
      if (previous) observer?.unobserve(previous);
      if (el) observer?.observe(el);
    },
    { immediate: true },
  );
});
onBeforeUnmount(() => observer?.disconnect());

function open(review: ReviewSegment) {
  if (!review.has_been_reviewed) void toggleReviewed(review);
  void router.push({
    name: "camera",
    params: { name: review.camera },
    query: { t: Math.floor(reviewStart(review)) },
  });
}

function patchLocal(ids: string[], reviewed: boolean) {
  if (!listKey.value) return;
  mutate<ReviewSegment[]>(listKey.value, (current) =>
    (current ?? []).map((item) =>
      ids.includes(item.id) ? { ...item, has_been_reviewed: reviewed } : item,
    ),
  );
}

async function toggleReviewed(review: ReviewSegment) {
  const next = !review.has_been_reviewed;
  patchLocal([review.id], next);
  await markReviewed([review.id], next).catch(() =>
    patchLocal([review.id], !next),
  );
  invalidate("review");
}

async function markAll() {
  const ids = (reviews.value ?? [])
    .filter((item) => !item.has_been_reviewed)
    .map((item) => item.id);
  patchLocal(ids, true);
  await markReviewed(ids);
  invalidate("review");
}
</script>

<template>
  <div class="review-view">
    <PageHeader :title="t('review.title')">
      <template #meta>
        <SeverityTabs v-model="severity" :counts="counts" />
      </template>
      <template #actions>
        <ToggleSwitch
          v-model="showReviewed"
          class="review-view__reviewed"
          :label="t('review.showReviewed')"
        />
        <CameraFilter v-model="selectedCameras" :cameras="cameras" />
        <IconButton :label="t('review.markAllReviewed')" @click="markAll"
          ><CheckCheck
        /></IconButton>
      </template>
    </PageHeader>

    <div class="review-view__scroll">
      <div v-if="isLoading" class="review-view__grid">
        <SkeletonBlock v-for="n in 8" :key="n" class="review-view__skeleton" />
      </div>
      <EmptyState
        v-else-if="!groups.length"
        :title="
          severity === 'alert'
            ? t('views/events:empty.alert')
            : t('views/events:empty.detection')
        "
      />
      <section
        v-for="group in groups"
        :key="group.key"
        class="review-view__day"
      >
        <h2 class="review-view__day-label">{{ group.label }}</h2>
        <div class="review-view__grid">
          <ReviewCard
            v-for="review in group.items"
            :key="review.id"
            :review="review"
            @open="open(review)"
            @toggle-reviewed="toggleReviewed(review)"
          />
        </div>
      </section>
      <div v-if="hasMore" ref="sentinel" class="review-view__sentinel" />
    </div>
  </div>
</template>

<style scoped>
.review-view {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
}

.review-view__scroll {
  flex: 1;
  min-block-size: 0;
  overflow-y: auto;
  padding: 16px 24px 32px;
}

.review-view__day + .review-view__day {
  margin-block-start: 24px;
}

.review-view__day-label {
  position: sticky;
  inset-block-start: -16px;
  z-index: 2;
  padding: 10px 0;
  font-size: var(--text-md);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: linear-gradient(var(--bg-deep) 70%, transparent);
}

.review-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.review-view__skeleton {
  aspect-ratio: 16 / 12;
  border-radius: var(--radius);
}

.review-view__sentinel {
  block-size: 1px;
}

@media (max-width: 768px) {
  .review-view__scroll {
    padding: 8px 10px 24px;
  }

  .review-view__grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 8px;
  }
}
</style>
