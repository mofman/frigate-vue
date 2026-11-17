<script setup lang="ts">
/**
 * Vertical timeline, newest at the top.
 *
 * Ticks, motion, recording gaps and review spans are painted on one canvas
 * that only draws the visible window, so a 24 hour timeline scrolls at 60fps.
 * The playhead is a DOM element inside the scroll content.
 *
 * The top anchor moves forward a row at a time, with the scroll offset
 * compensated in the same frame, so content never creeps as the clock ticks.
 *
 * Scrolling only browses, clicking or dragging the track seeks. While the
 * timeline follows the playhead, playback carries it up to a hold line and the
 * track then slides beneath it. Scrolling away stops following until the user
 * moves the playhead again (rules in timelineScroll.ts).
 */
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
} from "vue";
import { useConfig } from "@/composables/useFrigate";
import { useElementSize, useMediaQuery, useNow } from "@/composables/useUtil";
import type { ExportSelection } from "@/composables/useExportSelection";
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
import {
  DRAG_SLOP,
  HOLD_AT,
  MIN_HOLD,
  SCROLL_MS,
  TAP_SLOP,
  easeOutCubic,
  edgeSpeed,
  holdLine,
  holdScroll,
  revealScroll,
} from "./timelineScroll";
import TimelineHandle from "./TimelineHandle.vue";
import TimelineJump from "./TimelineJump.vue";
import TimelineSelection, { type SelectionEdge } from "./TimelineSelection.vue";
import TimelineZoom from "./TimelineZoom.vue";

const props = defineProps<{
  camera: string;
  playback: Playback;
  reviews: ReviewSegment[];
  /** the clip being picked for export, drawn as a band with two grips */
  selection?: ExportSelection;
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
    dpr,
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

// ---- scrolling -------------------------------------------------------------

const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

function onScroll() {
  scrollTop.value = scroller.value?.scrollTop ?? 0;
}

function maxScroll() {
  const el = scroller.value;
  return el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
}

function setScrollTop(value: number) {
  const el = scroller.value;
  if (!el) return;
  el.scrollTop = value;
  scrollTop.value = el.scrollTop;
}

// one animated scroll at a time, aimed at a time rather than a pixel offset
// so the anchor moving mid flight cannot knock it off course
let scrollFrame = 0;
let scrollFrom = 0;
let scrollGoal: { time: number; line: number } | undefined;

const goalTop = (goal: { time: number; line: number }) =>
  Math.min(Math.max(yAt(goal.time) - goal.line, 0), maxScroll());

function cancelScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
  scrollGoal = undefined;
}

/** Scroll so `time` sits `line` px below the top of the view. */
function scrollToTime(time: number, line: number, smooth: boolean) {
  cancelScroll();
  const el = scroller.value;
  if (!el) return;
  const goal = { time, line };
  if (!smooth || reducedMotion.value) {
    setScrollTop(goalTop(goal));
    resetHold();
    return;
  }
  scrollGoal = goal;
  scrollFrom = el.scrollTop;
  const start = performance.now();
  const step = (frameTime: number) => {
    const progress = Math.min(1, Math.max(0, (frameTime - start) / SCROLL_MS));
    setScrollTop(
      scrollFrom + (goalTop(goal) - scrollFrom) * easeOutCubic(progress),
    );
    if (progress < 1) {
      scrollFrame = requestAnimationFrame(step);
      return;
    }
    scrollFrame = 0;
    scrollGoal = undefined;
    resetHold();
  };
  scrollFrame = requestAnimationFrame(step);
}

watch(now, (current) => {
  if (current < top.value - (LEAD_ROWS - 1) * ROW * spp.value) return;
  const next = anchorFor(current);
  const delta = (next - top.value) / spp.value;
  top.value = next;
  // keep content visually still while the anchor moves
  const el = scroller.value;
  if (el) setScrollTop(el.scrollTop + delta);
  scrollFrom += delta;
});

// ---- following the playhead ------------------------------------------------

const handleTime = computed(() =>
  props.playback.isLive.value ? now.value : props.playback.displayTime.value,
);
const handleY = computed(() => yAt(handleTime.value));

/** the view follows the playhead; scrolling the timeline turns this off */
const attached = shallowRef(true);
/** px below the top of the view where a rising playhead is held */
let holdAt = MIN_HOLD;
let zooming = false;

// at most 30% down, and never lower than the live handle can sit at the top
// of the content, so following live never needs a negative scroll
const maxHoldLine = () =>
  Math.min(height.value * HOLD_AT, (LEAD_ROWS - 1) * ROW);

/** Hold the playhead where it is now, or at the hold line if lower. */
function resetHold() {
  const el = scroller.value;
  if (el) holdAt = holdLine(handleY.value - el.scrollTop, maxHoldLine());
}

/** Follow the playhead again, bringing it into view if it is not. */
function attach(smooth = true) {
  attached.value = true;
  const el = scroller.value;
  if (!el || !height.value || dragging.value) return;
  const line = holdLine(maxHoldLine(), maxHoldLine());
  // judge visibility where an animation in flight will leave the view
  const current = scrollGoal ? goalTop(scrollGoal) : el.scrollTop;
  const target = revealScroll({
    y: handleY.value,
    scrollTop: current,
    height: height.value,
    line,
    maxScroll: maxScroll(),
  });
  if (target === undefined) {
    if (!scrollFrame) resetHold();
    return;
  }
  // a long way off: jump, a sweep across hours of footage tells nothing
  const near = Math.abs(target - el.scrollTop) < 2 * height.value;
  scrollToTime(handleTime.value, line, smooth && near);
}

/** Keep a followed playhead on its hold line as playback carries it up. */
function hold() {
  const el = scroller.value;
  if (!el || !attached.value || dragging.value || zooming || scrollFrame)
    return;
  if (!height.value) return;
  const input = {
    y: handleY.value,
    scrollTop: el.scrollTop,
    maxScroll: maxScroll(),
  };
  // above the line: slide the track; dropped out of the bottom: bring it back
  const next =
    holdScroll({ ...input, line: holdAt }) ??
    revealScroll({ ...input, height: height.value, line: holdAt });
  if (next !== undefined) setScrollTop(next);
}

// one watcher so a user seek is always handled before the hold that follows
let seenReveal = props.playback.revealRequest.value;
watch(
  [handleY, () => props.playback.revealRequest.value],
  () => {
    const reveal = props.playback.revealRequest.value;
    if (reveal !== seenReveal) {
      seenReveal = reveal;
      attach();
      return;
    }
    hold();
  },
  { flush: "post" },
);

function onWheel(event: WheelEvent) {
  cancelScroll();
  const el = scroller.value;
  if (!el || !event.deltaY) return;
  // a wheel that cannot move the view is not looking elsewhere
  const stuck =
    event.deltaY < 0 ? el.scrollTop <= 0 : el.scrollTop >= maxScroll() - 1;
  if (!stuck) attached.value = false;
}

function onTouchMove() {
  // a finger panning the track, not dragging a handle
  if (!dragging.value) attached.value = false;
}

/** where the playhead went, once the user has scrolled it out of view */
const jumpDirection = computed(() => {
  if (!ready.value || dragging.value || attached.value) return undefined;
  const viewY = handleY.value - scrollTop.value;
  if (viewY < 0) return "up";
  if (viewY > height.value) return "down";
  return undefined;
});

function setZoom(index: number) {
  const el = scroller.value;
  cancelScroll();
  // keep what the user is looking at in place: the playhead while following,
  // otherwise the middle of the view
  const anchorTime = attached.value
    ? handleTime.value
    : timeAt(scrollTop.value + height.value / 2);
  const offset = el ? yAt(anchorTime) - el.scrollTop : 0;
  zooming = true;
  zoomIndex.value = index;
  top.value = anchorFor(now.value);
  // the content height changes on render, restore the offset after it
  void nextTick(() => {
    zooming = false;
    setScrollTop(yAt(anchorTime) - offset);
    if (attached.value) resetHold();
  });
}

// ---- scrubbing -------------------------------------------------------------

type DragTarget = "track" | "playhead" | SelectionEdge;

const dragging = shallowRef(false);
/** what the pointer is moving: the playhead or an edge of the selection */
let dragTarget: DragTarget = "playhead";
let pointerId: number | undefined;
/** past the slop, so a drag rather than a click */
let moved = false;
/** a finger is down on the track and may still turn out to be a tap */
let tapPending = false;
let downY = 0;
let lastClientY = 0;
let edgeFrame = 0;
let edgeTime = 0;
let edgeCarry = 0;

function timeFromClient(clientY: number) {
  const el = scroller.value;
  if (!el) return handleTime.value;
  const rect = el.getBoundingClientRect();
  return timeAt(el.scrollTop + clientY - rect.top);
}

/** Move whatever is being dragged to the pointer, kept inside the view. */
function dragTo(clientY: number) {
  const rect = scroller.value?.getBoundingClientRect();
  const y = rect
    ? Math.min(Math.max(clientY, rect.top + MIN_HOLD), rect.bottom - MIN_HOLD)
    : clientY;
  const time = timeFromClient(y);
  const selection = props.selection;
  if (selection && (dragTarget === "start" || dragTarget === "end")) {
    if (dragTarget === "start") selection.setStart(time);
    else selection.setEnd(time);
    // show the frame the clip will be cut on
    props.playback.scrubTo(selection.range.value[dragTarget]);
    return;
  }
  props.playback.scrubTo(time);
}

function startDrag(event: PointerEvent, target: DragTarget) {
  cancelScroll();
  // touch scrolls the timeline unless the drag starts on a handle
  if (event.pointerType === "touch" && target === "track") {
    downY = event.clientY;
    tapPending = true;
    return;
  }
  if (event.button !== 0) return;
  event.preventDefault();
  pointerId = event.pointerId;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  dragging.value = true;
  dragTarget = target;
  moved = false;
  downY = event.clientY;
  lastClientY = event.clientY;
  props.playback.beginScrub();
  if (target === "start" || target === "end") {
    // a preview loop would fight the scrub
    props.selection?.setPreviewing(false);
    props.playback.scrubTo(props.selection?.range.value[target] ?? 0);
  } else if (target === "playhead") {
    props.playback.scrubTo(handleTime.value);
  } else {
    // a click on the track puts the playhead right there
    dragTo(event.clientY);
  }
  edgeTime = performance.now();
  edgeCarry = 0;
  edgeFrame = requestAnimationFrame(edgeScrollTick);
}

function onMove(event: PointerEvent) {
  if (!dragging.value || event.pointerId !== pointerId) return;
  lastClientY = event.clientY;
  // hand tremor during a click must not nudge the playhead
  if (!moved && Math.abs(event.clientY - downY) <= DRAG_SLOP) return;
  moved = true;
  dragTo(event.clientY);
}

function endDrag(event: PointerEvent) {
  if (dragging.value) {
    if (event.pointerId !== pointerId) return;
    dragging.value = false;
    pointerId = undefined;
    cancelAnimationFrame(edgeFrame);
    props.playback.endScrub();
    return;
  }
  if (!tapPending || event.pointerType !== "touch") return;
  tapPending = false;
  // a pan ends in pointercancel once the browser takes over, only a lift
  // without travel is a tap
  if (
    event.type === "pointerup" &&
    Math.abs(event.clientY - downY) < TAP_SLOP
  ) {
    props.playback.seek(timeFromClient(event.clientY));
  }
}

/** Scroll while a drag is held near the top or bottom edge. */
function edgeScrollTick(frameTime: number) {
  const el = scroller.value;
  if (!el || !dragging.value) return;
  const seconds = Math.min(0.064, Math.max(0, frameTime - edgeTime) / 1000);
  edgeTime = frameTime;
  const rect = el.getBoundingClientRect();
  // only a real drag scrolls, a click near the edge stays put
  const speed = moved ? edgeSpeed(lastClientY, rect.top, rect.bottom) : 0;
  if (speed) {
    // whole pixels, as some browsers round a fractional scrollTop away
    edgeCarry += speed * seconds;
    const step = Math.trunc(edgeCarry);
    if (step) {
      edgeCarry -= step;
      setScrollTop(el.scrollTop + step);
      dragTo(lastClientY);
    }
  } else {
    edgeCarry = 0;
  }
  edgeFrame = requestAnimationFrame(edgeScrollTick);
}

// ---- export selection ------------------------------------------------------

const selectionY = computed(() => {
  const range = props.selection?.range.value;
  return range ? { start: yAt(range.start), end: yAt(range.end) } : undefined;
});
const timeLabel = (time: number) =>
  formatTime(time, {
    timezone: resolveTimezone(config.value?.ui?.timezone),
    hour12:
      config.value?.ui?.time_format === "12hour"
        ? true
        : config.value?.ui?.time_format === "24hour"
          ? false
          : undefined,
  });

function nudge(edge: SelectionEdge, seconds: number) {
  const selection = props.selection;
  if (!selection) return;
  const time = selection.range.value[edge] + seconds;
  if (edge === "start") selection.setStart(time);
  else selection.setEnd(time);
  props.playback.seek(selection.range.value[edge], false);
}

/** Bring the selection into view, eg when it opens or a preset is picked. */
function revealSelection() {
  const el = scroller.value;
  const y = selectionY.value;
  const range = props.selection?.range.value;
  if (!el || !y || !range || dragging.value || !height.value) return;
  const viewTop = el.scrollTop;
  const margin = 40;
  if (y.end >= viewTop + margin && y.start <= viewTop + height.value - margin)
    return;
  // the view now belongs to the selection, stop following the playhead
  attached.value = false;
  const span = y.start - y.end;
  // centre a selection that fits, otherwise show its newest edge
  const line =
    span < height.value - 2 * margin ? (height.value - span) / 2 : margin;
  scrollToTime(range.end, line, true);
}
watch(
  [() => props.selection?.active.value, () => props.selection?.range.value],
  ([active]) => {
    if (active) revealSelection();
  },
  { flush: "post" },
);

// place the playhead once the timeline has a size, instantly
const ready = shallowRef(false);
watch(
  height,
  (h) => {
    if (!h) return;
    if (!ready.value) {
      onScroll();
      attach(false);
      ready.value = true;
      if (props.selection?.active.value) revealSelection();
      return;
    }
    // a resize can leave the hold line below the new cap
    holdAt = holdLine(holdAt, maxHoldLine());
    hold();
  },
  { immediate: true },
);
onMounted(() => onScroll());
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  cancelAnimationFrame(edgeFrame);
  cancelScroll();
});

const futureHeight = computed(() => Math.max(0, yAt(now.value)));
const handleLabel = computed(() => timeLabel(handleTime.value));
const jumpLabel = computed(() =>
  props.playback.isLive.value ? t("timeline.live") : handleLabel.value,
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
      @wheel.passive="onWheel"
      @touchstart.passive="cancelScroll"
      @touchmove.passive="onTouchMove"
      @pointerdown="startDrag($event, 'track')"
      @pointermove="onMove"
      @pointerup="endDrag"
      @pointercancel="endDrag"
      @lostpointercapture="endDrag"
    >
      <div
        class="timeline__content"
        :style="{ blockSize: `${contentHeight}px` }"
      >
        <div
          class="timeline__future"
          :style="{ blockSize: `${futureHeight}px` }"
        />
        <TimelineSelection
          v-if="selection?.active.value && selectionY"
          :start-y="selectionY.start"
          :end-y="selectionY.end"
          :start-label="timeLabel(selection.range.value.start)"
          :end-label="timeLabel(selection.range.value.end)"
          @grab="(edge, event) => startDrag(event, edge)"
          @nudge="nudge"
        />
        <TimelineHandle
          :y="handleY"
          :label="handleLabel"
          :live="playback.isLive.value"
          @pointerdown.stop="startDrag($event, 'playhead')"
        />
      </div>
    </div>
    <div class="timeline__fade timeline__fade--top" />
    <div class="timeline__fade timeline__fade--bottom" />
    <TimelineJump
      v-if="jumpDirection"
      :direction="jumpDirection"
      :label="jumpLabel"
      :live="playback.isLive.value"
      @jump="attach()"
    />
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
  /* the timeline places its own scroll position (anchor shift, follow), a
     browser scroll anchor adjusting it too would move the track */
  overflow-anchor: none;
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
