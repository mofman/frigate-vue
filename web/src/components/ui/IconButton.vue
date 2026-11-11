<script setup lang="ts">
/** Square toolbar button holding a single icon, with an optional text label. */
withDefaults(
  defineProps<{
    label: string;
    size?: "md" | "sm";
    active?: boolean;
    showLabel?: boolean;
    disabled?: boolean;
  }>(),
  { size: "md", active: false, showLabel: false, disabled: false },
);
</script>

<template>
  <button
    type="button"
    class="icon-button"
    :class="[
      `icon-button--${size}`,
      { 'is-active': active, 'has-label': showLabel },
    ]"
    :aria-label="label"
    :aria-pressed="active || undefined"
    :title="showLabel ? undefined : label"
    :disabled="disabled"
  >
    <slot />
    <span v-if="showLabel" class="icon-button__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  inline-size: 34px;
  block-size: 34px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  color: var(--text-tertiary);
  transition:
    color var(--dur),
    border-color var(--dur),
    background var(--dur);

  &:hover:not(:disabled) {
    color: var(--text-primary);
    border-color: var(--line-hover);
    background: var(--bg-hover);
  }

  &:active:not(:disabled) {
    scale: 0.97;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &.is-active {
    color: var(--text-primary);
    border-color: var(--selected-border);
    background: var(--selected-surface);

    &:hover {
      background: var(--selected-surface-hover);
    }
  }

  &.has-label {
    inline-size: auto;
    padding-inline: 12px;
  }
}

.icon-button :deep(svg) {
  inline-size: 18px;
  block-size: 18px;
}

.icon-button--sm {
  inline-size: 28px;
  block-size: 28px;
}

.icon-button--sm :deep(svg) {
  inline-size: 14px;
  block-size: 14px;
}

.icon-button__label {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--text-secondary);

  .is-active & {
    color: var(--text-primary);
  }
}
</style>
