<script setup lang="ts">
/** Row inside a PopoverMenu. */
withDefaults(defineProps<{ selected?: boolean; disabled?: boolean }>(), {
  selected: false,
  disabled: false,
});
</script>

<template>
  <button
    type="button"
    class="menu-item"
    :class="{ 'is-selected': selected }"
    :disabled="disabled"
    role="menuitemradio"
    :aria-checked="selected"
  >
    <span v-if="$slots.icon" class="menu-item__icon"><slot name="icon" /></span>
    <span class="menu-item__text"><slot /></span>
    <span v-if="$slots.hint" class="menu-item__hint"><slot name="hint" /></span>
  </button>
</template>

<style scoped>
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  inline-size: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  font-size: var(--text-md);
  color: var(--text-secondary);
  text-align: start;

  &:hover:not(:disabled) {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  &.is-selected {
    color: var(--text-primary);
    background: var(--selected-surface);
  }

  &:disabled {
    opacity: 0.45;
  }
}

.menu-item__icon {
  color: var(--text-tertiary);
}

.menu-item__icon :deep(svg) {
  inline-size: 16px;
  block-size: 16px;
}

.menu-item__text {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-transform: capitalize;
}

.menu-item__hint {
  color: var(--text-tertiary);
  font-size: var(--text-xs);
}
</style>
