<script setup lang="ts">
/** Heading plus a responsive grid of metric cards. */
withDefaults(
  defineProps<{
    title?: string;
    /** minimum card width; wider cards suit line charts and tables */
    min?: string;
    loading?: boolean;
  }>(),
  { title: undefined, min: "260px", loading: false },
);
</script>

<template>
  <section class="system-section">
    <div v-if="title || $slots.actions" class="system-section__head">
      <h2 v-if="title">{{ title }}</h2>
      <div v-if="$slots.actions" class="system-section__actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="system-section__grid" :style="{ '--card-min': min }">
      <template v-if="loading">
        <div v-for="n in 3" :key="n" class="system-section__skeleton" />
      </template>
      <slot v-else />
    </div>
  </section>
</template>

<style scoped>
.system-section {
  display: grid;
  gap: 12px;
}

.system-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  h2 {
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }
}

.system-section__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.system-section__grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(min(var(--card-min), 100%), 1fr)
  );
  gap: 12px;
}

.system-section__skeleton {
  block-size: 140px;
  border-radius: var(--radius);
  background: linear-gradient(
    90deg,
    var(--bg-elevated) 25%,
    var(--bg-surface) 50%,
    var(--bg-elevated) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}
</style>
