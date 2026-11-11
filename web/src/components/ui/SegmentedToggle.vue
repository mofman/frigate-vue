<script setup lang="ts" generic="T extends string">
/** Small group of mutually exclusive buttons, eg grid / single layout. */
defineProps<{
  options: { value: T; label: string; icon?: unknown; text?: boolean }[];
  label: string;
}>();
const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="segmented" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="segmented__option"
      :class="{ 'is-active': model === option.value, 'has-text': option.text }"
      :aria-checked="model === option.value"
      :aria-label="option.label"
      :title="option.text ? undefined : option.label"
      @click="model = option.value"
    >
      <component :is="option.icon" v-if="option.icon" :size="14" />
      <span v-if="option.text">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-deep);
}

.segmented__option {
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: 6px;
  justify-content: center;
  min-inline-size: 30px;
  block-size: 26px;
  border-radius: var(--radius-xs);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  font-weight: 500;
  transition:
    color var(--dur),
    background var(--dur);

  &.has-text {
    padding-inline: 10px;
  }

  &:hover {
    color: var(--text-secondary);
  }

  &.is-active {
    background: var(--bg-surface);
    color: var(--text-primary);
  }
}
</style>
