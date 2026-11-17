<script setup lang="ts">
/**
 * Shown once the user has scrolled the playhead out of view: points to where
 * it went and scrolls back to it.
 */
import { ArrowDown, ArrowUp } from "@lucide/vue";
import { useT } from "@/composables/useT";

defineProps<{ direction: "up" | "down"; label: string; live: boolean }>();
const emit = defineEmits<{ jump: [] }>();
const { t } = useT(["views/app"]);
</script>

<template>
  <button
    type="button"
    class="jump"
    :class="[`jump--${direction}`, { 'is-live': live }]"
    :aria-label="t('timeline.jumpToPlayhead', { time: label })"
    @click="emit('jump')"
  >
    <ArrowUp v-if="direction === 'up'" aria-hidden="true" />
    <ArrowDown v-else aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>

<style scoped>
.jump {
  --tone: var(--playhead);
  position: absolute;
  inset-inline-start: 50%;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  block-size: 24px;
  padding-inline: 8px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--tone);
  background: color-mix(in srgb, var(--tone) 30%, var(--bg-bar));
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-pill);
  translate: -50% 0;
  transition:
    opacity var(--dur) var(--ease),
    translate var(--dur) var(--ease),
    background var(--dur-fast);

  svg {
    inline-size: 14px;
    block-size: 14px;
  }

  &:hover {
    background: color-mix(in srgb, var(--tone) 55%, var(--bg-bar));
  }

  &:focus-visible {
    outline: 2px solid var(--accent-text);
    outline-offset: 2px;
  }

  &.is-live {
    --tone: var(--live);
    font-family: var(--font-sans);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
}

/* below the top fade, and above the zoom buttons at the bottom */
.jump--up {
  inset-block-start: 10px;

  @starting-style {
    opacity: 0;
    translate: -50% -6px;
  }
}

.jump--down {
  inset-block-end: 56px;

  @starting-style {
    opacity: 0;
    translate: -50% 6px;
  }
}
</style>
