<script setup lang="ts">
/**
 * The export selection on the timeline: a tinted band between two grips.
 * Newest is at the top, so the end grip sits above the start grip.
 */
import { useT } from "@/composables/useT";

export type SelectionEdge = "start" | "end";

defineProps<{
  /** y of the start (older) edge */
  startY: number;
  /** y of the end (newer) edge */
  endY: number;
  startLabel: string;
  endLabel: string;
}>();
const emit = defineEmits<{
  grab: [edge: SelectionEdge, event: PointerEvent];
  nudge: [edge: SelectionEdge, seconds: number];
}>();
const { t } = useT(["views/app"]);

function onKey(edge: SelectionEdge, event: KeyboardEvent) {
  // up is later, matching the direction of the timeline
  const step = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  event.stopPropagation();
  emit("nudge", edge, step * (event.shiftKey ? 10 : 1));
}
</script>

<template>
  <div
    class="selection"
    :style="{
      translate: `0 ${endY}px`,
      blockSize: `${Math.max(1, startY - endY)}px`,
    }"
  >
    <button
      type="button"
      class="selection__grip selection__grip--end"
      :aria-label="t('export.endGrip', { time: endLabel })"
      @pointerdown.stop="emit('grab', 'end', $event)"
      @keydown="onKey('end', $event)"
    >
      {{ endLabel }}
    </button>
    <button
      type="button"
      class="selection__grip selection__grip--start"
      :aria-label="t('export.startGrip', { time: startLabel })"
      @pointerdown.stop="emit('grab', 'start', $event)"
      @keydown="onKey('start', $event)"
    >
      {{ startLabel }}
    </button>
  </div>
</template>

<style scoped>
.selection {
  position: absolute;
  inset: 0 0 auto;
  z-index: 3;
  pointer-events: none;
  background: var(--export-surface);
  border-block: 2px solid var(--export);
  /* dims everything outside the band, clipped by the scroller */
  box-shadow: 0 0 0 200vmax var(--export-scrim);
  will-change: translate, block-size;
}

.selection__grip {
  position: absolute;
  inset-inline-start: 50%;
  translate: -50% 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  block-size: 20px;
  min-inline-size: 78px;
  padding-inline: 8px;
  background: var(--export);
  color: var(--text-on-media);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-pill);
  pointer-events: auto;
  cursor: ns-resize;
  touch-action: none;

  /* a larger target than the pill itself, for fingers */
  &::after {
    content: "";
    position: absolute;
    inset: -8px -10px;
  }

  &:focus-visible {
    outline: 2px solid var(--accent-text);
    outline-offset: 2px;
  }
}

/* the pills hang outside the band so they never cover the playhead */
.selection__grip--end {
  inset-block-end: 100%;
  border-radius: var(--radius-xs) var(--radius-xs) 0 0;
}

.selection__grip--start {
  inset-block-start: 100%;
  border-radius: 0 0 var(--radius-xs) var(--radius-xs);
}
</style>
