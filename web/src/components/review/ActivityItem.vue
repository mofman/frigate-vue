<script setup lang="ts">
/** Recent activity row: snapshot, label, camera and relative time. */
import { computed } from "vue";
import { cameraLabel, useCamera } from "@/composables/useFrigate";
import { useNow } from "@/composables/useUtil";
import { useT } from "@/composables/useT";
import SnapshotBadge from "@/components/ui/SnapshotBadge.vue";
import type { ReviewSegment } from "@/types/frigate";
import { formatRelative } from "@/utils/time";
import { reviewLabel, reviewThumb } from "@/utils/review";

const props = defineProps<{ review: ReviewSegment }>();
const { t } = useT(["views/app", "objects"]);
const now = useNow(30_000);
const camera = useCamera(() => props.review.camera);
const label = computed(() => reviewLabel(props.review));
const labelText = computed(() =>
  t(`objects:${label.value}`, { defaultValue: label.value }),
);
</script>

<template>
  <button
    type="button"
    class="activity-item"
    :class="{
      'is-alert': review.severity === 'alert',
      'is-unreviewed': !review.has_been_reviewed,
    }"
  >
    <span class="activity-item__snapshot">
      <img :src="reviewThumb(review)" alt="" loading="lazy" decoding="async" />
      <SnapshotBadge :label="label" />
    </span>
    <span class="activity-item__details">
      <span class="activity-item__label">{{ labelText }}</span>
      <span class="activity-item__camera">{{
        cameraLabel(camera, review.camera)
      }}</span>
      <time class="activity-item__time">{{
        formatRelative(review.start_time, now)
      }}</time>
    </span>
  </button>
</template>

<style scoped>
.activity-item {
  display: flex;
  gap: 10px;
  inline-size: 100%;
  padding: 8px;
  margin-block-end: 4px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  text-align: start;
  transition: background var(--dur);

  &:hover {
    background: var(--bg-surface);
    border-color: var(--glass-border);
  }

  &.is-alert {
    background: color-mix(in srgb, var(--alert-amber) 6%, transparent);
    border-color: color-mix(in srgb, var(--alert-amber) 18%, transparent);

    &:hover {
      background: color-mix(in srgb, var(--alert-amber) 10%, transparent);
    }
  }
}

.activity-item__snapshot {
  position: relative;
  flex-shrink: 0;
  inline-size: 80px;
  block-size: 52px;
  overflow: hidden;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-media);

  img {
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
  }
}

.activity-item__details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-inline-size: 0;
}

.activity-item__label {
  font-size: var(--text-sm);
  font-weight: 600;
  text-transform: capitalize;
}

.activity-item__camera {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-item__time {
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--text-tertiary);
}

/* the tablet strip turns rows into thumbnail cards */
@container activity (max-height: 200px) {
  .activity-item,
  .activity-item.is-alert {
    position: relative;
    display: block;
    flex: 0 0 clamp(150px, 22vw, 220px);
    aspect-ratio: 16 / 9;
    padding: 0;
    margin: 0;
    border-color: var(--glass-border);
    background: var(--bg-media);
  }

  .activity-item__snapshot {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    border: none;
    border-radius: 0;

    img {
      object-fit: cover;
    }
  }

  .activity-item__snapshot :deep(.snapshot-badge) {
    inset: 8px auto auto 8px;
    background: var(--bg-badge-neutral);
    box-shadow: none;
    backdrop-filter: blur(8px);
  }

  .activity-item__details {
    position: absolute;
    inset: auto 0 0;
    padding: 22px 8px 7px;
    background: var(--scrim-thumb);
  }

  .activity-item__label,
  .activity-item__camera {
    display: none;
  }

  .activity-item__time {
    font-family: var(--font-sans);
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--text-on-media);
    text-shadow: var(--text-shadow-media-strong);
  }
}
</style>
