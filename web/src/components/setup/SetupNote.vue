<script setup lang="ts">
/** Quiet callout inside a setup step. */
</script>

<template>
  <div class="setup-note"><slot /></div>
</template>

<style scoped>
.setup-note {
  display: grid;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-xs);
  background: var(--bg-surface);
  font-size: var(--text-md);
  color: var(--text-secondary);
}
</style>
