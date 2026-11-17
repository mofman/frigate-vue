<script setup lang="ts">
/**
 * One export: thumbnail that plays it, name, where and when, and its
 * actions. While the export is still being made the thumbnail shows the
 * job's progress instead.
 */
import { computed } from "vue";
import { Download, Pencil, Play, Share2, Trash2 } from "@lucide/vue";
import {
  cameraLabel,
  useCamera,
  useTimeOptions,
} from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { Export, ExportJob } from "@/types/export";
import { exportThumb, exportVideo } from "@/utils/exports";
import { formatDateTime } from "@/utils/time";

const props = defineProps<{
  item: Export;
  /** the job making this export, while it is queued or running */
  job?: ExportJob;
  admin: boolean;
}>();
defineEmits<{ play: []; share: []; rename: []; remove: [] }>();

const { t } = useT(["views/app"]);
const camera = useCamera(() => props.item.camera);
const timeOptions = useTimeOptions();

const pending = computed(() => props.item.in_progress || !!props.job);
const percent = computed(() =>
  Math.round(Math.min(100, Math.max(0, props.job?.progress_percent ?? 0))),
);
const step = computed(() => {
  switch (props.job?.current_step) {
    case "preparing":
      return t("exports.step.preparing");
    case "copying":
      return t("exports.step.copying");
    case "encoding":
    case "encoding_retry":
      return t("exports.step.encoding");
    case "merging":
      return t("exports.step.merging");
    case "finalizing":
      return t("exports.step.finalizing");
    case "queued":
      return t("exports.step.queued");
    default:
      return t("exports.step.working");
  }
});
const name = computed(() => props.item.name.replaceAll("_", " "));
const thumb = computed(() => exportThumb(props.item));
</script>

<template>
  <article class="export-card" :class="{ 'is-pending': pending }">
    <button
      type="button"
      class="export-card__media"
      :disabled="pending"
      :aria-label="t('exports.play', { name })"
      @click="$emit('play')"
    >
      <img
        v-if="thumb"
        class="export-card__thumb"
        :src="thumb"
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span v-if="pending" class="export-card__progress">
        <span class="export-card__step">
          {{ step }}
          <template v-if="job && job.status === 'running'">
            · {{ percent }}%
          </template>
        </span>
        <progress
          class="export-card__meter"
          max="100"
          :value="job?.status === 'running' ? percent : undefined"
          :aria-label="t('exports.progress', { name })"
        />
      </span>
      <span v-else class="export-card__play" aria-hidden="true">
        <Play :size="20" />
      </span>
    </button>
    <div class="export-card__body">
      <h3 class="export-card__name" :title="name">{{ name }}</h3>
      <p class="export-card__meta">
        <span>{{ cameraLabel(camera, item.camera) }}</span>
        <time>{{ formatDateTime(item.date, timeOptions) }}</time>
      </p>
      <div v-if="!pending" class="export-card__actions">
        <a
          class="export-card__action"
          :href="exportVideo(item)"
          download
          :aria-label="t('exports.download')"
          :title="t('exports.download')"
        >
          <Download :size="15" />
        </a>
        <button
          type="button"
          class="export-card__action"
          :aria-label="t('exports.share')"
          :title="t('exports.share')"
          @click="$emit('share')"
        >
          <Share2 :size="15" />
        </button>
        <template v-if="admin">
          <button
            type="button"
            class="export-card__action"
            :aria-label="t('exports.rename')"
            :title="t('exports.rename')"
            @click="$emit('rename')"
          >
            <Pencil :size="15" />
          </button>
          <button
            type="button"
            class="export-card__action is-danger"
            :aria-label="t('exports.delete')"
            :title="t('exports.delete')"
            @click="$emit('remove')"
          >
            <Trash2 :size="15" />
          </button>
        </template>
      </div>
    </div>
  </article>
</template>

<style scoped>
.export-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-card);
  transition:
    border-color var(--dur),
    box-shadow var(--dur);

  &:hover {
    border-color: var(--line-hover);
    box-shadow: var(--shadow-card-hover);
  }
}

.export-card__media {
  position: relative;
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--bg-media);

  &:disabled {
    cursor: default;
  }
}

.export-card__thumb {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;

  .is-pending & {
    opacity: 0.35;
  }
}

.export-card__play {
  position: absolute;
  inset: 50% auto auto 50%;
  translate: -50% -50%;
  display: grid;
  place-items: center;
  inline-size: 44px;
  block-size: 44px;
  border-radius: var(--radius-pill);
  background: var(--bg-overlay-control);
  color: var(--text-on-media);
  backdrop-filter: blur(6px);
  opacity: 0;
  transition: opacity var(--dur);

  .export-card__media:is(:hover, :focus-visible) & {
    opacity: 1;
  }
}

.export-card__progress {
  position: absolute;
  inset: auto 12px 12px;
  display: grid;
  gap: 6px;
  text-align: start;
}

.export-card__step {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-on-media);
  text-shadow: var(--text-shadow-media);
}

.export-card__meter {
  appearance: none;
  inline-size: 100%;
  block-size: 4px;
  border: none;
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: var(--line-overlay);

  &::-webkit-progress-bar {
    background: var(--line-overlay);
  }

  &::-webkit-progress-value {
    background: var(--export);
    transition: inline-size var(--dur);
  }

  &::-moz-progress-bar {
    background: var(--export);
  }
}

.export-card__body {
  display: grid;
  gap: 6px;
  padding: 10px 12px 12px;
}

.export-card__name {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.export-card__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-tertiary);

  span {
    text-transform: capitalize;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  time {
    flex-shrink: 0;
    font-family: var(--font-mono);
  }
}

.export-card__actions {
  display: flex;
  gap: 6px;
}

.export-card__action {
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  transition:
    color var(--dur),
    background var(--dur),
    border-color var(--dur);

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
    border-color: var(--line-hover);
  }

  &.is-danger {
    margin-inline-start: auto;

    &:hover {
      color: var(--danger);
      background: var(--danger-surface);
      border-color: color-mix(in srgb, var(--danger) 35%, transparent);
    }
  }
}
</style>
