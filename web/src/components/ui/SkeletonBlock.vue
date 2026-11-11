<script setup lang="ts">
/** Placeholder block with a soft shimmer. */
</script>

<template>
  <div class="skeleton" aria-hidden="true" />
</template>

<style scoped>
.skeleton {
  border-radius: var(--radius-xs);
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 25%,
    var(--bg-surface) 37%,
    var(--bg-elevated) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}
</style>
