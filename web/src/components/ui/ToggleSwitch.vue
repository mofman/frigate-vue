<script setup lang="ts">
/** Accessible on/off switch. */
defineProps<{ label: string; disabled?: boolean }>();
const model = defineModel<boolean>({ required: true });
</script>

<template>
  <label class="toggle" :class="{ 'is-disabled': disabled }">
    <span class="toggle__label">{{ label }}</span>
    <input
      v-model="model"
      class="toggle__input"
      type="checkbox"
      role="switch"
      :disabled="disabled"
    />
    <span class="toggle__track" aria-hidden="true"
      ><span class="toggle__thumb"
    /></span>
  </label>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  cursor: pointer;
  font-size: var(--text-md);
  color: var(--text-secondary);

  &:hover {
    background: var(--bg-surface);
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.toggle__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle__track {
  position: relative;
  inline-size: 30px;
  block-size: 18px;
  border-radius: var(--radius-pill);
  background: var(--bg-hover);
  border: 1px solid var(--glass-border);
  transition: background var(--dur);
  flex-shrink: 0;
}

.toggle__thumb {
  position: absolute;
  inset-block-start: 2px;
  inset-inline-start: 2px;
  inline-size: 12px;
  block-size: 12px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition:
    translate var(--dur) var(--ease),
    background var(--dur);
}

.toggle:has(.toggle__input:checked) {
  .toggle__track {
    background: var(--accent-strong);
    border-color: transparent;
  }

  .toggle__thumb {
    translate: 12px 0;
    background: var(--text-on-media);
  }
}

.toggle:has(.toggle__input:focus-visible) .toggle__track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
