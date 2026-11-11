<script setup lang="ts">
/**
 * Compact metric in the status bar. Tone shifts with the value; with `to` it
 * links to the page that explains it.
 */
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";

const props = defineProps<{
  label: string;
  value: string;
  level?: number;
  to?: RouteLocationRaw;
}>();
const tone = computed(() => {
  if (props.level === undefined) return "healthy";
  if (props.level >= 90) return "danger";
  if (props.level >= 75) return "warning";
  return "healthy";
});
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'div'"
    :to="to"
    class="status-chip"
    :class="[`is-${tone}`, { 'is-link': to }]"
  >
    <span class="status-chip__dot" aria-hidden="true" />
    <span class="status-chip__label">{{ label }}</span>
    <span class="status-chip__value">{{ value }}</span>
  </component>
</template>

<style scoped>
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  --dot: var(--online);
  --dot-glow: var(--online-glow);

  &.is-warning {
    --dot: var(--warning);
    --dot-glow: var(--warning-glow);
  }

  &.is-danger {
    --dot: var(--danger);
    --dot-glow: var(--danger-glow);
  }

  &.is-link {
    transition: border-color var(--dur);

    &:hover {
      border-color: var(--line-hover);
    }
  }
}

.status-chip__dot {
  inline-size: 5px;
  block-size: 5px;
  border-radius: 50%;
  background: var(--dot);
  box-shadow: 0 0 4px var(--dot-glow);
}

.status-chip__label {
  font-size: var(--text-2xs);
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.status-chip__value {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
}
</style>
