<script setup lang="ts">
/** Wrapping group of toggle chips for picking several values. */
defineProps<{ options: { value: string; label: string }[] }>();
const model = defineModel<string[]>({ required: true });

function toggle(value: string) {
  model.value = model.value.includes(value)
    ? model.value.filter((item) => item !== value)
    : [...model.value, value];
}
</script>

<template>
  <div class="filter-chips">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="filter-chips__chip"
      :aria-pressed="model.includes(option.value)"
      @click="toggle(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-chips__chip {
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--bg-deep);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-transform: capitalize;

  &:hover {
    border-color: var(--line-hover);
  }

  &[aria-pressed="true"] {
    border-color: color-mix(in srgb, var(--accent) 45%, transparent);
    background: var(--selected-surface);
    color: var(--text-primary);
  }
}
</style>
