<script setup lang="ts">
/**
 * Vertical timeline, newest at the top.
 *
 * Ticks, motion, recording gaps and review spans are painted on one canvas
 * that only draws the visible window, so a 24 hour timeline scrolls at 60fps.
 * The playhead is a DOM element inside the scroll content.
 *
 * The top anchor moves forward in half hour steps, with the scroll offset
 * compensated in the same frame, so content never creeps as the clock ticks.
 */
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { useConfig } from "@/composables/useFrigate";
import { useElementSize, useNow } from "@/composables/useUtil";
import type { Playback } from "@/composables/usePlayback";
import { useTimelineData } from "@/composables/useTimelineData";
import { useT } from "@/composables/useT";
import type { ReviewSegment } from "@/types/frigate";
import { formatTime, resolveTimezone } from "@/utils/time";
import {
  draw,
  readPalette,
  ROW,
  ZOOM_LEVELS,
  type Palette,
} from "./timelineDraw";
import TimelineHandle from "./TimelineHandle.vue";
import TimelineZoom from "./TimelineZoom.vue";

const props = defineProps<{
  camera: string;
  playback: Playback;
  reviews: ReviewSegment[];
}>();

const { t } = useT(["views/app"]);
const { data: config } = useConfig();
const now = useNow(1000);

const zoomIndex = shallowRef(0);
const zoom = computed(() => ZOOM_LEVELS[zoomIndex.value]!);
const spp = computed(() => zoom.value.secondsPerPx);

// the top of the timeline sits a fixed number of rows above now, on a row
// boundary: room for the live handle plus a short "future" strip above it
const LEAD_ROWS = 16;
const anchorFor = (time: number) => {
  const segment = ROW * spp.value;
  return Math.ceil((time + LEAD_ROWS * segment) / segment) * segment;
};
const top = shallowRef(anchorFor(Date.now() / 1000));

const scroller = shallowRef<HTMLDivElement | null>(null);
const canvas = shallowRef<HTMLCanvasElement | null>(null);
const { width, height } = useElementSize(scroller);
const scrollTop = shallowRef(0);

const earliest = computed(() => props.playback.earliest.value);
const contentHeight = computed(() => (top.value - earliest.value) / spp.value);

const yAt = (time: number) => (top.value - time) / spp.value;
const timeAt = (y: number) => top.value - y * spp.value;

const visibleRange = computed(() => {
  const before = timeAt(scrollTop.value);
  const after = timeAt(scrollTop.value + height.value);
  // overscan by half a screen so fast scrolls already have data
  const pad = (height.value * spp.value) / 2;
  return { after: after - pad, before: before + pad };
});

const timeline = useTimelineData(
  () => props.camera,
  visibleRange,
  () => zoom.value.motionScale,
);

// ---- painting --------------------------------------------------------------

let palette: Palette | undefined;
let frame = 0;

function paint() {
  frame = 0;
  const el = canvas.value;
  if (!el || !width.value || !height.value) return;
  palette ??= readPalette(el);
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(width.value * dpr);
  const h = Math.round(height.value * dpr);
  if (el.width !== w || el.height !== h) {
    el.width = w;
    el.height = h;
  }
  const ctx = el.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  draw(ctx, {
    width: width.value,
    height: height.value,
    topTime: timeAt(scrollTop.value),
    secondsPerPx: spp.value,
    now: now.value,
    earliest: earliest.value,
    zoom: zoom.value,
    buckets: timeline.buckets(),
    reviews: props.reviews,
    palette,
    formatLabel: (time, withSeconds) =>
      formatTime(time, {
        timezone: resolveTimezone(config.value?.ui?.timezone),
        seconds: withSeconds,
        hour12:
          config.value?.ui?.time_format === "12hour"
            ? true
            : config.value?.ui?.time_format === "24hour"
              ? false
              : undefined,
      }),
  });
}

function schedulePaint() {
  if (!frame) frame = requestAnimationFrame(paint);
}

watch(
  [
    width,
    height,
    scrollTop,
    spp,
    timeline.version,
    () => props.reviews,
    now,
    earliest,
  ],
  schedulePaint,
);

// ---- anchor & scroll -------------------------------------------------------

watch(now, (current) => {
  if (current < top.value - (LEAD_ROWS - 1) * ROW * spp.value) return;
  const next = anchorFor(current);
  const delta = (next - top.value) / spp.value;
  top.value = next;
  // keep content visually still while the anchor moves
  if (scroller.value) scroller.value.scrollTop += delta;
});

const handleTime = computed(() =>
  props.playback.isLive.value ? now.value : props.playback.displayTime.value,
);
const handleY = computed(() => yAt(handleTime.value));

let lastUserScroll = 0;
function onScroll() {
  scrollTop.value = scroller.value?.scrollTop ?? 0;
}
function markUserScroll() {
  lastUserScroll = performance.now();
}

/** Keep the playhead on screen unless the user is looking elsewhere. */
function follow(force = false) {
  const el = scroller.value;
  if (!el || dragging.value || !height.value) return;
  if (!force && performance.now() - lastUserScroll < 4000) return;
  const y = handleY.value;
  const viewTop = el.scrollTop;
  if (
    !force &&
    y > viewTop + height.value * 0.12 &&
    y < viewTop + height.value * 0.85
  )
    return;
  el.scrollTo({
    top: Math.max(0, y - height.value * 0.3),
    behavior: force ? "auto" : "smooth",
  });
}

watch(handleY, () => follow());
watch(
  () => props.playback.isLive.value,
  (live) => {
    if (live) {
      lastUserScroll = 0;
      follow(true);
    }
  },
);

function setZoom(index: number) {
  const el = scroller.value;
  const anchorTime = handleTime.value;
  const offset = el ? handleY.value - el.scrollTop : 0;
  zoomIndex.value = index;
  top.value = anchorFor(now.value);
  requestAnimationFrame(() => {
    if (!el) return;
    el.scrollTop = yAt(anchorTime) - offset;
    onScroll();
  });
}

// ---- scrubbing -------------------------------------------------------------

const dragging = shallowRef(false);
let pointerId: number | undefined;
let moved = false;
let downY = 0;
let autoScroll = 0;
let lastClientY = 0;

function timeFromClient(clientY: number) {
  const el = scroller.value;
  if (!el) return handleTime.value;
  const rect = el.getBoundingClientRect();
  return timeAt(el.scrollTop + clientY - rect.top);
}

function startDrag(event: PointerEvent, fromHandle: boolean) {
  // touch scrolls the timeline unless the drag starts on the playhead
  if (event.pointerType === "touch" && !fromHandle) {
    downY = event.clientY;
    moved = false;
    pointerId = undefined;
    return;
  }
  if (event.button !== 0) return;
  event.preventDefault();
  pointerId = event.pointerId;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  dragging.value = true;
  moved = false;
  downY = event.clientY;
  lastClientY = event.clientY;
  props.playback.beginScrub();
  props.playback.scrubTo(
    fromHandle ? handleTime.value : timeFromClient(event.clientY),
  );
  autoScroll = requestAnimationFrame(autoScrollTick);
}

function onMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== pointerId) return;
  if (Math.abs(event.clientY - downY) > 3) moved = true;
  lastClientY = event.clientY;
  props.playback.scrubTo(timeFromClient(event.clientY));
}

function endDrag(event: PointerEvent) {
  if (event.pointerType === "touch" && pointerId === undefined) {
    // a tap without scrolling seeks there
    if (Math.abs(event.clientY - downY) < 6) {
      props.playback.seek(timeFromClient(event.clientY));
    }
    return;
  }
  if (!dragging.value || event.pointerId !== pointerId) return;
  dragging.value = false;
  pointerId = undefined;
  cancelAnimationFrame(autoScroll);
  void moved;
  props.playback.endScrub();
}

function autoScrollTick() {
  const el = scroller.value;
  if (!el || !dragging.value) return;
  const rect = el.getBoundingClientRect();
  const edge = 40;
  let delta = 0;
  if (lastClientY < rect.top + edge)
    delta = -Math.ceil((rect.top + edge - lastClientY) / 4);
  else if (lastClientY > rect.bottom - edge)
    delta = Math.ceil((lastClientY - rect.bottom + edge) / 4);
  if (delta) {
    el.scrollTop += delta;
    props.playback.scrubTo(timeFromClient(lastClientY));
  }
  autoScroll = requestAnimationFrame(autoScrollTick);
}

// place the playhead once the timeline has a size, instantly
const ready = shallowRef(false);
watch(
  height,
  (h) => {
    if (!h || ready.value) return;
    follow(true);
    onScroll();
    ready.value = true;
  },
  { immediate: true },
);
onMounted(() => onScroll());
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  cancelAnimationFrame(autoScroll);
});

const futureHeight = computed(() => Math.max(0, yAt(now.value)));
const handleLabel = computed(() =>
  formatTime(handleTime.value, {
    timezone: resolveTimezone(config.value?.ui?.timezone),
    hour12:
      config.value?.ui?.time_format === "12hour"
        ? true
        : config.value?.ui?.time_format === "24hour"
          ? false
          : undefined,
  }),
);
</script>

<template>
  <div
    class="timeline"
    :class="{ 'is-dragging': dragging, 'is-live': playback.isLive.value }"
    :data-ready="ready || undefined"
  >
    <canvas ref="canvas" class="timeline__canvas" aria-hidden="true" />
    <div
      ref="scroller"
      class="timeline__scroller"
      role="slider"
      :aria-label="t('timeline.label')"
      :aria-valuetext="handleLabel"
      @scroll.passive="onScroll"
      @wheel.passive="markUserScroll"
      @touchmove.passive="markUserScroll"
      @pointerdown="startDrag($event, false)"
      @pointermove="onMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <div
        class="timeline__content"
        :style="{ blockSize: `${contentHeight}px` }"
      >
        <div
          class="timeline__future"
          :style="{ blockSize: `${futureHeight}px` }"
        />
        <TimelineHandle
          :y="handleY"
          :label="handleLabel"
          :live="playback.isLive.value"
          @pointerdown.stop="startDrag($event, true)"
        />
      </div>
    </div>
    <div class="timeline__fade timeline__fade--top" />
    <div class="timeline__fade timeline__fade--bottom" />
    <TimelineZoom
      class="timeline__zoom"
      :level="zoomIndex"
      :levels="ZOOM_LEVELS.length"
      @update:level="setZoom"
    />
  </div>
</template>

<style scoped>
.timeline {
  --tone-future: var(--text-tertiary);
  position: relative;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
  overflow: hidden;
  background: var(--bg-bar);
  border-inline-start: 1px solid var(--glass-border);
  user-select: none;
}

.timeline.is-live {
  --tone-future: var(--live);
}

.timeline__canvas {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  pointer-events: none;
}

.timeline__scroller {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  touch-action: pan-y;
  cursor: ns-resize;

  &::-webkit-scrollbar {
    display: none;
  }
}

.timeline__content {
  position: relative;
}

.timeline__future {
  position: absolute;
  inset: 0 0 auto;
  pointer-events: none;
  background:
    linear-gradient(
      to bottom,
      transparent 35%,
      color-mix(in srgb, var(--tone-future) 18%, transparent)
    ),
    repeating-linear-gradient(
      -45deg,
      transparent 0 7px,
      color-mix(in srgb, var(--text-tertiary) 16%, transparent) 7px 8px
    );
  /* fade in from the top so the strip reads as "not yet" rather than a box */
  mask-image: linear-gradient(to bottom, transparent, var(--bg-media) 35%);
}

.timeline__fade {
  position: absolute;
  inset-inline: 0;
  block-size: 30px;
  pointer-events: none;
  z-index: 2;
}

.timeline__fade--top {
  inset-block-start: 0;
  background: linear-gradient(to bottom, var(--bg-bar), transparent);
}

.timeline__fade--bottom {
  inset-block-end: 0;
  background: linear-gradient(to top, var(--bg-bar), transparent);
}

.timeline__zoom {
  position: absolute;
  inset: auto 8px 12px;
  z-index: 3;
}

.is-dragging .timeline__scroller {
  cursor: grabbing;
}
</style>
