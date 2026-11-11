<script setup lang="ts">
/**
 * Click to centre, drag a box to zoom. Sits over the live picture while
 * click to move is on.
 */
import { computed, shallowRef } from "vue";
import { relativeMoveCommand } from "@/utils/ptz";

const emit = defineEmits<{ move: [command: string] }>();

type Point = { x: number; y: number };
const origin = shallowRef<Point>();
const current = shallowRef<Point>();

function point(event: PointerEvent): Point {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function down(event: PointerEvent) {
  if (event.button !== 0) return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  origin.value = point(event);
  current.value = origin.value;
}

function move(event: PointerEvent) {
  if (origin.value) current.value = point(event);
}

function up(event: PointerEvent) {
  const start = origin.value;
  origin.value = undefined;
  current.value = undefined;
  if (!start) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const command = relativeMoveCommand(start, point(event), rect);
  if (command) emit("move", command);
}

function cancel() {
  origin.value = undefined;
  current.value = undefined;
}

const box = computed(() => {
  if (!origin.value || !current.value) return undefined;
  return {
    x: Math.min(origin.value.x, current.value.x),
    y: Math.min(origin.value.y, current.value.y),
    width: Math.abs(current.value.x - origin.value.x),
    height: Math.abs(current.value.y - origin.value.y),
  };
});
</script>

<template>
  <div
    class="ptz-click-layer"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="cancel"
    @click.stop
  >
    <svg v-if="box" class="ptz-click-layer__box" aria-hidden="true">
      <rect
        :x="box.x"
        :y="box.y"
        :width="box.width"
        :height="box.height"
        rx="2"
      />
    </svg>
  </div>
</template>

<style scoped>
.ptz-click-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  cursor: crosshair;
  touch-action: none;
  pointer-events: auto;
}

.ptz-click-layer__box {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;

  rect {
    fill: color-mix(in srgb, var(--text-on-media) 8%, transparent);
    stroke: var(--text-on-media);
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }
}
</style>
