<script setup lang="ts">
/**
 * Detail of the review item under the playhead: what was seen, where, and
 * each tracked object with a jump to when it appeared.
 */
import { computed } from "vue";
import { baseUrl } from "@/api/baseUrl";
import { useQuery } from "@/api/query";
import DetectionTag from "@/components/ui/DetectionTag.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import { useConfig } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { ReviewSegment } from "@/types/frigate";
import { formatDuration, formatTime, resolveTimezone } from "@/utils/time";
import { REVIEW_PADDING, reviewThumb } from "@/utils/review";

type TrackedObject = {
  id: string;
  label: string;
  sub_label?: string | null;
  start_time: number;
  end_time?: number | null;
  zones: string[];
  data?: { score?: number; top_score?: number };
  top_score?: number;
};

const props = defineProps<{ review?: ReviewSegment }>();
const emit = defineEmits<{ seek: [time: number] }>();
const { t } = useT(["views/app", "objects", "views/events"]);
const { data: config } = useConfig();
const timezone = computed(() => resolveTimezone(config.value?.ui?.timezone));

const ids = computed(() => props.review?.data.detections ?? []);
const { data: objects } = useQuery<TrackedObject[]>(
  () => (ids.value.length ? ["events", { ids: ids.value.join(",") }] : null),
  { staleTime: 10_000 },
);
const tracked = computed(() =>
  ids.value.length
    ? (objects.value ?? [])
        .filter((obj) => ids.value.includes(obj.id))
        .sort((a, b) => a.start_time - b.start_time)
    : [],
);

const labels = computed(() => {
  const data = props.review?.data;
  if (!data) return [];
  return [
    ...new Set(
      [...(data.sub_labels ?? []), ...data.objects, ...data.audio].map(
        (label) => label.replace(/-verified$/, ""),
      ),
    ),
  ];
});

function time(seconds: number) {
  return formatTime(seconds, { timezone: timezone.value, seconds: true });
}

function score(obj: TrackedObject) {
  const value = obj.data?.top_score ?? obj.top_score ?? obj.data?.score;
  return value ? `${Math.round(value * 100)}%` : "";
}
</script>

<template>
  <div class="review-detail">
    <template v-if="review">
      <img class="review-detail__thumb" :src="reviewThumb(review)" alt="" />
      <div class="review-detail__head">
        <span class="review-detail__severity" :class="`is-${review.severity}`">
          {{
            review.severity === "alert"
              ? t("views/events:alerts")
              : t("views/events:detections")
          }}
        </span>
        <time>{{ time(review.start_time) }}</time>
        <span class="review-detail__duration">{{
          review.end_time
            ? formatDuration(review.end_time - review.start_time)
            : t("review.inProgress")
        }}</span>
      </div>
      <p v-if="review.data.metadata?.title" class="review-detail__summary">
        <strong>{{ review.data.metadata.title }}</strong>
        {{ review.data.metadata.scene }}
      </p>
      <div class="review-detail__tags">
        <DetectionTag
          v-for="label in labels"
          :key="label"
          :label="label"
          :text="t(`objects:${label}`, { defaultValue: label })"
        />
      </div>
      <dl v-if="review.data.zones.length" class="review-detail__zones">
        <dt>{{ t("toolbar.zones") }}</dt>
        <dd>
          {{ review.data.zones.map((z) => z.replaceAll("_", " ")).join(", ") }}
        </dd>
      </dl>

      <h3 v-if="tracked.length" class="review-detail__title">
        {{ t("toolbar.trackedObjects") }}
      </h3>
      <ul class="review-detail__objects">
        <li v-for="obj in tracked" :key="obj.id">
          <button
            type="button"
            class="review-detail__object"
            @click="emit('seek', obj.start_time - REVIEW_PADDING)"
          >
            <img
              :src="`${baseUrl}api/events/${obj.id}/thumbnail.webp`"
              alt=""
              loading="lazy"
            />
            <span class="review-detail__object-text">
              <span class="review-detail__object-label">
                {{
                  obj.sub_label ||
                  t(`objects:${obj.label}`, { defaultValue: obj.label })
                }}
                <span class="review-detail__score">{{ score(obj) }}</span>
              </span>
              <span class="review-detail__object-meta">
                {{ time(obj.start_time) }}
                <template v-if="obj.zones.length">
                  · {{ obj.zones.join(", ").replaceAll("_", " ") }}</template
                >
              </span>
            </span>
          </button>
        </li>
      </ul>
    </template>
    <EmptyState v-else :title="t('toolbar.noDetail')" />
  </div>
</template>

<style scoped>
.review-detail {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 12px;
  overflow-y: auto;
  min-block-size: 0;
  block-size: 100%;
}

.review-detail__thumb {
  inline-size: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--bg-media);
}

.review-detail__head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.review-detail__severity {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--selected-surface);
  color: var(--accent-text);
  font-weight: 600;

  &.is-alert {
    background: color-mix(in srgb, var(--warning) 18%, transparent);
    color: var(--warning);
  }
}

.review-detail__duration {
  margin-inline-start: auto;
  color: var(--text-tertiary);
}

.review-detail__summary {
  margin: 0;
  font-size: var(--text-md);
  color: var(--text-secondary);

  strong {
    display: block;
    color: var(--text-primary);
  }
}

.review-detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.review-detail__zones {
  display: flex;
  gap: 8px;
  margin: 0;
  font-size: var(--text-sm);

  dt {
    color: var(--text-tertiary);
  }

  dd {
    margin: 0;
    text-transform: capitalize;
  }
}

.review-detail__title {
  margin: 4px 0 0;
  font-size: var(--text-2xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.review-detail__objects {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.review-detail__object {
  display: flex;
  align-items: center;
  gap: 10px;
  inline-size: 100%;
  padding: 6px;
  border-radius: var(--radius-xs);
  text-align: start;

  &:hover {
    background: var(--bg-surface);
  }

  img {
    inline-size: 48px;
    block-size: 48px;
    flex-shrink: 0;
    object-fit: cover;
    border-radius: var(--radius-xs);
    background: var(--bg-media);
  }
}

.review-detail__object-text {
  display: grid;
  gap: 2px;
  min-inline-size: 0;
}

.review-detail__object-label {
  font-size: var(--text-md);
  font-weight: 600;
  text-transform: capitalize;
}

.review-detail__score {
  margin-inline-start: 6px;
  font-weight: 400;
  color: var(--text-tertiary);
}

.review-detail__object-meta {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
