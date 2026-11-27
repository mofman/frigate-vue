<script setup lang="ts">
/** Labelled native select. */
import { useId } from "vue";

defineProps<{
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
}>();
const model = defineModel<string>({ required: true });
const id = useId();
</script>

<template>
  <div class="select-field">
    <span class="select-field__heading">
      <label :for="id">{{ label }}</label>
      <slot name="label-extra" />
    </span>
    <select :id="id" v-model="model">
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
    <p v-if="hint" class="select-field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.select-field {
  display: grid;
  gap: 6px;
  min-inline-size: 0;

  select {
    inline-size: 100%;
    block-size: 36px;
    padding-inline: 8px;
    border-radius: var(--radius-xs);
    border: 1px solid var(--glass-border);
    background: var(--bg-deep);
    font-size: var(--text-md);
    color: var(--text-primary);

    &:focus {
      outline: none;
      border-color: var(--accent);
    }
  }
}

.select-field__heading {
  display: flex;
  align-items: center;
  gap: 4px;
  min-block-size: 18px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.select-field__hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}
</style>
