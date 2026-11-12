<script setup lang="ts">
/**
 * Review item card. Plays the server-rendered preview clip on hover, which
 * starts instantly because it is preloaded once the card scrolls into view.
 */
import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";
import { Check } from "@lucide/vue";
import { cameraLabel, useCamera, useConfig } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import DetectionTag from "@/components/ui/DetectionTag.vue";
import type { ReviewSegment } from "@/types/frigate";
import { formatDuration, formatTime, resolveTimezone } from "@/utils/time";
import { reviewPreview, reviewThumb } from "@/utils/review";

const props = defineProps<{ review: ReviewSegment; selected?: boolean }>();
defineEmits<{ open: []; toggleReviewed: [] }>();

const { t } = useT(["views/app", "objects"]);
const camera = useCamera(() => props.review.camera);
const { data: config } = useConfig();

const root = shallowRef<HTMLElement | null>(null);
const video = shallowRef<HTMLVideoElement | null>(null);
const nearViewport = shallowRef(false);
const previewing = shallowRef(false);

let observer: IntersectionObserver | undefined;
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) {
        nearViewport.value = true;
        observer?.disconnect();
      }
    },
    { rootMargin: "200px" },
  );
  if (root.value) observer.observe(root.value);
});
onBeforeUnmount(() => observer?.disconnect());

function startPreview() {
  previewing.value = true;
  video.value?.play().catch(() => undefined);
}
function stopPreview() {
  previewing.value = false;
  if (video.value) {
    video.value.pause();
    video.value.currentTime = 0;
  }
}

const labels = computed(() => {
  const all = [
    ...(props.review.data.sub_labels ?? []),
    ...props.review.data.objects,
    ...props.review.data.audio,
  ];
  return [
    ...new Set(all.map((label) => label.replace(/-verified$/, ""))),
  ].slice(0, 3);
});
const time = computed(() =>
  formatTime(props.review.start_time, {
    timezone: resolveTimezone(config.value?.ui?.timezone),
    seconds: false,
  }),
);
const duration = computed(() =>
  props.review.end_time
    ? formatDuration(props.review.end_time - props.review.start_time)
    : t("review.inProgress"),
);
</script>

<template>
  <article
    ref="root"
    class="review-card"
    :class="[
      `is-${review.severity}`,
      { 'is-reviewed': review.has_been_reviewed, 'is-selected': selected },
    ]"
  >
    <button
      type="button"
      class="review-card__media"
      :aria-label="
        t('review.open', { camera: cameraLabel(camera, review.camera), time })
      "
      @click="$emit('open')"
      @pointerenter="startPreview"
      @pointerleave="stopPreview"
      @focus="startPreview"
      @blur="stopPreview"
    >
      <img
        class="review-card__thumb"
        :src="reviewThumb(review)"
        alt=""
        loading="lazy"
        decoding="async"
      />
      <video
        v-if="nearViewport && reviewPreview(review)"
        ref="video"
        class="review-card__preview"
        :class="{ 'is-playing': previewing }"
        :src="reviewPreview(review)"
        muted
        loop
        playsinline
        preload="metadata"
      />
      <span class="review-card__severity" />
      <span class="review-card__duration">{{ duration }}</span>
    </button>
    <div class="review-card__body">
      <div class="review-card__meta">
        <span class="review-card__camera">{{
          cameraLabel(camera, review.camera)
        }}</span>
        <time class="review-card__time">{{ time }}</time>
      </div>
      <div class="review-card__footer">
        <div class="review-card__tags">
          <DetectionTag
            v-for="label in labels"
            :key="label"
            :label="label"
            :text="t(`objects:${label}`, { defaultValue: label })"
          />
        </div>
        <button
          type="button"
          class="review-card__mark"
          :class="{ 'is-on': review.has_been_reviewed }"
          :aria-pressed="review.has_been_reviewed"
          :title="
            review.has_been_reviewed
              ? t('review.markUnreviewed')
              : t('review.markReviewed')
          "
          @click="$emit('toggleReviewed')"
        >
          <Check :size="14" />
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.review-card {
  --severity: var(--accent);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-card);
  transition:
    border-color var(--dur),
    box-shadow var(--dur),
    opacity var(--dur);

  &.is-alert {
    --severity: var(--warning);
  }

  &:hover {
    border-color: var(--line-hover);
    box-shadow: var(--shadow-card-hover);
  }

  &.is-reviewed {
    opacity: 0.72;
  }

  &.is-selected {
    border-color: var(--selected-border);
  }
}

.review-card__media {
  position: relative;
  /* the thumbnail keeps its 16:9 even when the card is squeezed */
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
  background: var(--bg-media);
  overflow: hidden;
}

.review-card__thumb,
.review-card__preview {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.review-card__preview {
  opacity: 0;
  transition: opacity var(--dur);

  &.is-playing {
    opacity: 1;
  }
}

.review-card__severity {
  position: absolute;
  inset: 0 auto 0 0;
  inline-size: 3px;
  background: var(--severity);
  box-shadow: 0 0 10px var(--severity);
}

.review-card__duration {
  position: absolute;
  inset: auto 8px 8px auto;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--bg-chip-on-media-strong);
  backdrop-filter: blur(4px);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--text-on-media-muted);
}

.review-card__body {
  display: grid;
  gap: 8px;
  padding: 10px 12px 12px;
}

.review-card__meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}

.review-card__camera {
  font-size: var(--text-md);
  font-weight: 600;
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.review-card__time {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.review-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.review-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-inline-size: 0;
}

.review-card__mark {
  display: grid;
  place-items: center;
  inline-size: 26px;
  block-size: 26px;
  flex-shrink: 0;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  color: var(--text-tertiary);
  transition:
    color var(--dur),
    background var(--dur),
    border-color var(--dur);

  &:hover {
    color: var(--text-primary);
    border-color: var(--line-hover);
  }

  &.is-on {
    color: var(--online);
    background: var(--online-surface);
    border-color: color-mix(in srgb, var(--online) 25%, transparent);
  }
}
</style>
