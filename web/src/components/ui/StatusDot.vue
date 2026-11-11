<script setup lang="ts">
/** Pulsing dot: blue when live, amber when something is happening. */
withDefaults(defineProps<{ state?: "live" | "alert" | "offline" }>(), {
  state: "live",
});
</script>

<template>
  <span class="status-dot" :class="`status-dot--${state}`" aria-hidden="true" />
</template>

<style scoped>
.status-dot {
  inline-size: 7px;
  block-size: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot--live {
  background: var(--online);
  box-shadow: 0 0 8px var(--online-glow);
  animation: pulse-dot 2.5s ease-in-out infinite;
}

.status-dot--alert {
  background: var(--warning);
  box-shadow: 0 0 8px var(--warning-glow);
  animation: pulse-dot 1s ease-in-out infinite;
}

.status-dot--offline {
  background: var(--text-tertiary);
}
</style>
