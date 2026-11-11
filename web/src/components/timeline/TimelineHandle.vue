<script setup lang="ts">
/** The playhead: a line across the timeline with a draggable time pill. */
import { useT } from "@/composables/useT";

defineProps<{ y: number; label: string; live: boolean }>();
const { t } = useT(["views/app"]);
</script>

<template>
  <div
    class="handle"
    :class="{ 'is-live': live }"
    :style="{ translate: `0 ${y}px` }"
  >
    <span class="handle__line" />
    <span class="handle__pill">
      <template v-if="live">
        <span class="handle__dot" />
        {{ t("timeline.live") }}
      </template>
      <template v-else>{{ label }}</template>
    </span>
  </div>
</template>

<style scoped>
.handle {
  --tone: var(--playhead);
  position: absolute;
  inset: 0 0 auto;
  block-size: 0;
  z-index: 4;
  will-change: translate;

  &.is-live {
    --tone: var(--live);
  }
}

.handle__line {
  position: absolute;
  inset-inline: 0;
  inset-block-start: -1.5px;
  block-size: 3px;
  background: var(--tone);
  opacity: 0.9;
  pointer-events: none;
}

.handle__pill {
  position: absolute;
  inset-block-start: -12px;
  inset-inline-start: 50%;
  translate: -50% 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  block-size: 24px;
  min-inline-size: 76px;
  padding-inline: 10px;
  border-radius: var(--radius-pill);
  background: var(--tone);
  color: var(--text-on-media);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  white-space: nowrap;
  box-shadow: var(--shadow-pill);
  cursor: grab;
  touch-action: none;

  .is-live & {
    font-family: var(--font-sans);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    border: 1px solid var(--live-border);
    box-shadow: 0 0 24px var(--live-glow);
  }
}

.handle__dot {
  inline-size: 6px;
  block-size: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot 2.5s ease-in-out infinite;
}
</style>
