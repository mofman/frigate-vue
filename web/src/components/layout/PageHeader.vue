<script setup lang="ts">
/** Glass header bar with a title area and an actions area. */
defineProps<{ title?: string }>();
</script>

<template>
  <header class="page-header">
    <div class="page-header__start">
      <slot name="start" />
      <h1 v-if="title" class="page-header__title">{{ title }}</h1>
      <slot name="meta" />
    </div>
    <div class="page-header__end">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 24px;
  background: var(--bg-header);
  backdrop-filter: blur(12px);
  border-block-end: 1px solid var(--glass-border);
  position: relative;
  z-index: 5;
  min-block-size: 63px;
}

.page-header__start {
  display: flex;
  align-items: center;
  gap: 12px;
  min-inline-size: 0;
}

.page-header__title {
  font-size: var(--text-lg);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: capitalize;
}

.page-header__end {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    padding: 12px 14px;
  }

  .page-header__end {
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-inline-start: auto;
  }
}
</style>
