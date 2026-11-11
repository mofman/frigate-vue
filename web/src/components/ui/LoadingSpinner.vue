<script setup lang="ts">
/** Indeterminate ring, only shown after a short delay to avoid flicker. */
withDefaults(defineProps<{ size?: number; delay?: number; label?: string }>(), {
  size: 22,
  delay: 300,
  label: "",
});
</script>

<template>
  <span
    class="spinner"
    role="status"
    :aria-label="label || undefined"
    :style="{ '--size': `${size}px`, '--delay': `${delay}ms` }"
  />
</template>

<style scoped>
.spinner {
  display: inline-block;
  inline-size: var(--size);
  block-size: var(--size);
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--text-primary) 18%, transparent);
  border-top-color: var(--text-primary);
  animation:
    spin 0.8s linear infinite,
    spinner-in var(--dur) var(--delay) both;
}

@keyframes spinner-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
