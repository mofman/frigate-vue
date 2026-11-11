<script setup lang="ts">
/** Titled panel holding one or more charts on the System page. */
defineProps<{ title: string }>();
</script>

<template>
  <section class="metric-card">
    <header class="metric-card__head">
      <h3>{{ title }}</h3>
      <div v-if="$slots.actions" class="metric-card__actions">
        <slot name="actions" />
      </div>
    </header>
    <div class="metric-card__body"><slot /></div>
  </section>
</template>

<style scoped>
.metric-card {
  display: grid;
  align-content: start;
  gap: 14px;
  min-inline-size: 0;
  padding: 14px 16px 16px;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-card);
}

.metric-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-block-size: 24px;

  h3 {
    font-size: var(--text-md);
    font-weight: 600;
  }
}

.metric-card__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.metric-card__body {
  display: grid;
  gap: 16px;
  min-inline-size: 0;
}
</style>
