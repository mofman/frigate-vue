<script setup lang="ts">
/** Draws an object's path, box and zones over its clip. */
import { computed } from "vue";
import { useConfig } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { TimelineEntry, TrackedEvent } from "@/types/event";
import {
  detectTime,
  nearestBoxEntry,
  objectColor,
  overlayStrokes,
  pathPoints,
  recordTime,
  visiblePath,
  zoneColor,
  zonePolygon,
  zonesAt,
} from "@/utils/tracking";

const props = defineProps<{
  event: TrackedEvent;
  timeline: TimelineEntry[];
  /** recording time of the current frame */
  time: number;
  offsetMs: number;
  width: number;
  height: number;
}>();
const emit = defineEmits<{ seek: [recordTime: number] }>();

const { t } = useT(["views/events"]);
const { data: config } = useConfig();

const detect = computed(() => detectTime(props.time, props.offsetMs));
const strokes = computed(() => overlayStrokes(props.width, props.height));
const color = computed(() =>
  objectColor(config.value, props.event.label, props.event.id),
);
const allPoints = computed(() => pathPoints(props.event, props.timeline));

const points = computed(() =>
  visiblePath(allPoints.value, detect.value, props.event.start_time).map(
    (point) => ({
      ...point,
      cx: point.x * props.width,
      cy: point.y * props.height,
    }),
  ),
);

const line = computed(() =>
  points.value
    .map(({ cx, cy }, index) => `${index ? "L" : "M"} ${cx} ${cy}`)
    .join(" "),
);

function scaled(box: readonly number[]) {
  return {
    x: box[0]! * props.width,
    y: box[1]! * props.height,
    width: box[2]! * props.width,
    height: box[3]! * props.height,
  };
}

const current = computed(() => nearestBoxEntry(props.timeline, detect.value));
const box = computed(() =>
  current.value?.data.box ? scaled(current.value.data.box) : undefined,
);
const attributeBox = computed(() =>
  current.value?.data.attribute_box
    ? scaled(current.value.data.attribute_box)
    : undefined,
);

const zones = computed(() => {
  if (!points.value.length) return [];
  const camera = config.value?.cameras[props.event.camera];
  return zonesAt(props.timeline, detect.value).flatMap((name) => {
    const zone = camera?.zones?.[name];
    if (!zone) return [];
    return [
      {
        name,
        points: zonePolygon(zone.coordinates, props.width, props.height),
        color: zoneColor(config.value, props.event.camera, name),
      },
    ];
  });
});

function pointTitle(point: (typeof points.value)[number]) {
  const name = point.classType
    ? point.classType.replaceAll("_", " ")
    : t("objectTrack.trackedPoint");
  return `${name}, ${new Date(point.timestamp * 1000).toLocaleTimeString()}. ${t("objectTrack.clickToSeek")}`;
}
</script>

<template>
  <svg
    v-if="points.length && width && height"
    class="track-overlay"
    :viewBox="`0 0 ${width} ${height}`"
    aria-hidden="true"
    :style="{ '--object': color }"
  >
    <polygon
      v-for="zone in zones"
      :key="zone.name"
      class="track-overlay__zone"
      :points="zone.points"
      :stroke-width="strokes.zone"
      :style="{ '--zone': zone.color || undefined }"
    />
    <path
      v-if="points.length > 1"
      class="track-overlay__path"
      :d="line"
      :stroke-width="strokes.path"
    />
    <circle
      v-for="point in points"
      :key="`${point.timestamp}-${point.classType ?? 'path'}`"
      class="track-overlay__point"
      :class="point.classType && `is-${point.classType}`"
      :cx="point.cx"
      :cy="point.cy"
      :r="strokes.pointRadius"
      :stroke-width="strokes.pointStroke"
      @click="emit('seek', recordTime(point.timestamp, offsetMs))"
    >
      <title>{{ pointTitle(point) }}</title>
    </circle>
    <g v-if="box">
      <rect
        class="track-overlay__box"
        v-bind="box"
        :stroke-width="strokes.box"
      />
      <circle
        class="track-overlay__foot"
        :cx="box.x + box.width / 2"
        :cy="box.y + box.height"
        :r="strokes.highlightRadius"
        :stroke-width="strokes.box"
      />
    </g>
    <rect
      v-if="attributeBox"
      class="track-overlay__box"
      v-bind="attributeBox"
      :stroke-width="strokes.box"
    />
  </svg>
</template>

<style scoped>
.track-overlay {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  pointer-events: none;
}

.track-overlay__zone {
  --zone: var(--track-gone);
  fill: color-mix(in srgb, var(--zone) 30%, transparent);
  stroke: var(--zone);
  opacity: 0.7;
}

.track-overlay__path {
  fill: none;
  stroke: var(--object);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.track-overlay__point {
  fill: var(--object);
  stroke: var(--track-point);
  cursor: pointer;
  pointer-events: auto;

  &.is-visible {
    fill: var(--track-visible);
  }
  &.is-gone {
    fill: var(--track-gone);
  }
  &.is-entered_zone {
    fill: var(--track-zone);
  }
  &.is-attribute {
    fill: var(--track-attribute);
  }
  &.is-active {
    fill: var(--track-active);
  }
  &.is-stationary {
    fill: var(--track-stationary);
  }
  &.is-heard {
    fill: var(--track-heard);
  }
  &.is-external {
    fill: var(--track-external);
  }
}

.track-overlay__box {
  fill: none;
  stroke: var(--object);
  opacity: 0.9;
}

.track-overlay__foot {
  fill: var(--track-active);
  stroke: var(--object);
}
</style>
