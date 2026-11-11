<script setup lang="ts">
/** Scrolling list of a camera's review items, newest first. */
import { computed, nextTick, shallowRef, watch } from "vue";
import { invalidate } from "@/api/query";
import EmptyState from "@/components/ui/EmptyState.vue";
import { useT } from "@/composables/useT";
import type { ReviewSegment } from "@/types/frigate";
import { markReviewed } from "@/utils/review";
import ReviewCard from "./ReviewCard.vue";

const props = defineProps<{
  reviews: ReviewSegment[];
  /** id of the item under the playhead */
  current?: string;
}>();
const emit = defineEmits<{ open: [review: ReviewSegment] }>();
const { t } = useT(["views/app"]);

const sorted = computed(() =>
  [...props.reviews].sort((a, b) => b.start_time - a.start_time),
);

const list = shallowRef<HTMLElement | null>(null);
watch(
  () => props.current,
  async (id) => {
    if (!id) return;
    await nextTick();
    list.value
      ?.querySelector(`[data-review="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  },
);

async function toggleReviewed(review: ReviewSegment) {
  await markReviewed([review.id], !review.has_been_reviewed).catch(
    () => undefined,
  );
  invalidate("review");
}
</script>

<template>
  <div ref="list" class="event-list">
    <ReviewCard
      v-for="review in sorted"
      :key="review.id"
      :data-review="review.id"
      :review="review"
      :selected="review.id === current"
      @open="emit('open', review)"
      @toggle-reviewed="toggleReviewed(review)"
    />
    <EmptyState v-if="!sorted.length" :title="t('toolbar.noEvents')" />
  </div>
</template>

<style scoped>
.event-list {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 12px;
  overflow-y: auto;
  min-block-size: 0;
  block-size: 100%;
}
</style>
