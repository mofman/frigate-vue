<script setup lang="ts">
/** Small tinted count label, eg "4 live". */
withDefaults(defineProps<{ tone?: "online" | "warning" | "neutral" }>(), {
  tone: "online",
});
</script>

<template>
  <span class="count-pill" :class="`count-pill--${tone}`"><slot /></span>
</template>

<style scoped>
.count-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-xs);
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

.count-pill--online {
  color: var(--online);
  background: var(--online-surface);
  border: 1px solid color-mix(in srgb, var(--online) 20%, transparent);
}

.count-pill--warning {
  color: var(--warning);
  background: var(--warning-surface);
  border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent);
}

.count-pill--neutral {
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--glass-border);
}
</style>
