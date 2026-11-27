<script setup lang="ts">
/** One choice in a radio group, with an optional description. */
defineProps<{
  name: string;
  value: string;
  label: string;
  description?: string;
  badge?: string;
}>();
const model = defineModel<string>({ required: true });
</script>

<template>
  <label class="radio-option">
    <input v-model="model" type="radio" :name="name" :value="value" />
    <span class="radio-option__text">
      <span class="radio-option__label">
        {{ label }}
        <span v-if="badge" class="radio-option__badge">{{ badge }}</span>
      </span>
      <span v-if="description" class="radio-option__description">
        {{ description }}
      </span>
    </span>
  </label>
</template>

<style scoped>
.radio-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  cursor: pointer;
  transition:
    background var(--dur),
    border-color var(--dur);

  &:hover {
    background: var(--bg-surface);
  }

  &:has(input:checked) {
    border-color: var(--selected-border);
    background: var(--selected-surface);
  }

  input {
    flex-shrink: 0;
    margin: 2px 0 0;
    accent-color: var(--accent-strong);
  }
}

.radio-option__text {
  display: grid;
  gap: 2px;
  min-inline-size: 0;
}

.radio-option__label {
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--text-primary);
}

.radio-option__badge {
  margin-inline-start: 6px;
  font-size: var(--text-xs);
  color: var(--accent-text);
}

.radio-option__description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
</style>
