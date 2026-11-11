<script setup lang="ts">
/** Centered message for empty lists or unavailable media. */
defineProps<{ title: string; description?: string }>();
</script>

<template>
  <div class="empty-state">
    <div v-if="$slots.icon" class="empty-state__icon"><slot name="icon" /></div>
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="description" class="empty-state__description">{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 32px 16px;
  text-align: center;
  color: var(--text-tertiary);
}

.empty-state__icon {
  color: var(--text-tertiary);
}

.empty-state__icon :deep(svg) {
  inline-size: 28px;
  block-size: 28px;
}

.empty-state__title {
  color: var(--text-secondary);
  font-size: var(--text-base);
  font-weight: 500;
}

.empty-state__description {
  font-size: var(--text-sm);
  max-inline-size: 36ch;
}
</style>
