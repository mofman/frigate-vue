<script setup lang="ts">
/** One tracked object: its thumbnail, score, match badge and time. */
import { computed, onBeforeUnmount, shallowRef } from "vue";
import { AlignLeft, Image } from "@lucide/vue";
import DetectionTag from "@/components/ui/DetectionTag.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import {
  cameraLabel,
  useCamera,
  useConfig,
  useTimeOptions,
} from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { TrackedEvent } from "@/types/event";
import { eventLabelKey, eventScore, eventThumbnail } from "@/utils/explore";
import { formatDateTime, formatRelative } from "@/utils/time";

const LONG_PRESS_MS = 610;

const props = defineProps<{
  event: TrackedEvent;
  selected?: boolean;
  flash?: boolean;
  /** explanation of why a search matched this object */
  match?: string;
}>();
const emit = defineEmits<{ open: []; toggleSelect: [] }>();

const { t } = useT(["views/explore", "objects", "audio"]);
const { data: config } = useConfig();
const camera = useCamera(() => props.event.camera);
const timeOptions = useTimeOptions();

const labelText = computed(() =>
  t(eventLabelKey(props.event), {
    defaultValue: props.event.label.replaceAll("_", " "),
  }),
);

const isAttribute = computed(
  () =>
    !!props.event.sub_label &&
    !!config.value?.model?.attributes_map?.[props.event.label]?.includes(
      props.event.sub_label,
    ),
);

/** an attribute such as a delivery company stands in for the label's icon */
const iconLabel = computed(() =>
  isAttribute.value ? props.event.sub_label! : props.event.label,
);

const chip = computed(() => {
  const score = `${Math.floor(eventScore(props.event) * 100)}%`;
  const detail = props.event.sub_label
    ? isAttribute.value
      ? ""
      : props.event.sub_label
    : props.event.data.recognized_license_plate;
  return detail ? `${score} (${detail})` : score;
});

const when = computed(() =>
  formatDateTime(props.event.start_time, timeOptions.value),
);

let pressTimer: ReturnType<typeof setTimeout> | undefined;
const pressed = shallowRef(false);

function cancelPress() {
  clearTimeout(pressTimer);
}

function onPointerDown(event: PointerEvent) {
  if (event.pointerType !== "touch") return;
  pressed.value = false;
  pressTimer = setTimeout(() => {
    pressed.value = true;
    emit("toggleSelect");
  }, LONG_PRESS_MS);
}

function onClick(event: MouseEvent) {
  // the click that ends a long press has already selected the card
  if (pressed.value) {
    pressed.value = false;
    return;
  }
  if (event.metaKey || event.ctrlKey) emit("toggleSelect");
  else emit("open");
}

onBeforeUnmount(cancelPress);
</script>

<template>
  <article
    class="explore-card"
    :class="{ 'is-selected': selected, 'is-flashing': flash }"
    :data-event-id="event.id"
  >
    <button
      type="button"
      class="explore-card__media"
      :aria-label="
        t('ui.openObject', {
          label: labelText,
          camera: cameraLabel(camera, event.camera),
          time: when,
        })
      "
      :aria-pressed="selected || undefined"
      @click="onClick"
      @contextmenu.prevent="$emit('toggleSelect')"
      @pointerdown="onPointerDown"
      @pointerup="cancelPress"
      @pointercancel="cancelPress"
      @pointermove="cancelPress"
    >
      <img
        class="explore-card__thumb"
        :src="eventThumbnail(event)"
        alt=""
        loading="lazy"
        decoding="async"
        draggable="false"
      />
    </button>
    <DetectionTag
      class="explore-card__tag"
      :label="iconLabel"
      :text="chip"
      :title="event.sub_label ?? labelText"
    />
    <span
      v-if="match"
      class="explore-card__match"
      :title="match"
      role="img"
      :aria-label="match"
    >
      <Image v-if="event.search_source === 'thumbnail'" :size="12" />
      <AlignLeft v-else :size="12" />
    </span>
    <footer class="explore-card__footer">
      <div class="explore-card__time">
        <LoadingSpinner v-if="!event.end_time" :size="12" :delay="0" />
        <span v-else>{{ formatRelative(event.start_time) }}</span>
        <time>{{ when }}</time>
      </div>
      <slot name="actions" />
    </footer>
  </article>
</template>

<style scoped>
.explore-card {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--bg-surface);
  /* off screen cards skip layout and paint on long result lists */
  content-visibility: auto;
  contain-intrinsic-size: auto 240px;
  container-type: inline-size;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    outline: 3px solid transparent;
    outline-offset: -3px;
    pointer-events: none;
    transition: outline-color var(--dur);
  }

  &.is-selected::after,
  &.is-flashing::after {
    outline-color: var(--accent-strong);
  }
}

.explore-card__media {
  display: block;
  inline-size: 100%;
  block-size: 100%;
  padding: 0;
  -webkit-touch-callout: none;
  user-select: none;

  &:hover .explore-card__thumb {
    scale: 1.03;
  }

  &:focus-visible {
    outline-offset: -3px;
  }
}

.explore-card__thumb {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  transition: scale var(--dur) var(--ease);
}

.explore-card__tag {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-start: 8px;
  max-inline-size: calc(100% - 44px);
  pointer-events: none;
}

.explore-card__match {
  position: absolute;
  inset-block-start: 8px;
  inset-inline-end: 8px;
  display: grid;
  place-items: center;
  inline-size: 22px;
  block-size: 22px;
  border-radius: var(--radius-pill);
  background: var(--bg-chip-on-media-strong);
  color: var(--text-on-media);
}

.explore-card__footer {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6px;
  padding: 24px 8px 6px;
  background: linear-gradient(
    to top,
    var(--bg-chip-on-media-strong),
    transparent
  );
  color: var(--text-on-media);
  pointer-events: none;
}

.explore-card__footer :deep(.result-menu__trigger),
.explore-card__footer :deep([popover]) {
  pointer-events: auto;
}

.explore-card__time {
  display: grid;
  gap: 1px;
  min-inline-size: 0;
  font-size: var(--text-xs);

  time {
    overflow: hidden;
    color: var(--text-on-media-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@container (max-width: 150px) {
  .explore-card__time time {
    display: none;
  }
}
</style>
