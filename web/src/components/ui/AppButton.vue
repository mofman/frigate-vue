<script setup lang="ts">
/** Text button with an optional leading icon, for toolbars and dialogs. */
withDefaults(
  defineProps<{
    variant?: "default" | "primary" | "danger";
    size?: "md" | "sm";
    type?: "button" | "submit";
    disabled?: boolean;
    /** hide the text below this container width, keeping the icon */
    compact?: boolean;
  }>(),
  {
    variant: "default",
    size: "md",
    type: "button",
    disabled: false,
    compact: false,
  },
);
</script>

<template>
  <button
    :type="type"
    class="app-button"
    :class="[
      `app-button--${variant}`,
      `app-button--${size}`,
      { 'is-compact': compact },
    ]"
    :disabled="disabled"
  >
    <span v-if="$slots.icon" class="app-button__icon"
      ><slot name="icon"
    /></span>
    <span class="app-button__text"><slot /></span>
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
  block-size: 34px;
  padding-inline: 14px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--text-md);
  font-weight: 600;
  white-space: nowrap;
  transition:
    background var(--dur),
    border-color var(--dur);

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--line-hover);
  }

  &:active:not(:disabled) {
    scale: 0.98;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.app-button--sm {
  block-size: 28px;
  padding-inline: 10px;
  font-size: var(--text-sm);
}

.app-button--primary {
  border-color: transparent;
  background: var(--accent-strong);
  color: var(--text-on-media);

  &:hover:not(:disabled) {
    border-color: transparent;
    background: color-mix(in srgb, var(--accent-strong), white 12%);
  }
}

.app-button--danger {
  border-color: transparent;
  background: var(--danger);
  color: var(--text-on-media);

  &:hover:not(:disabled) {
    border-color: transparent;
    background: color-mix(in srgb, var(--danger), white 12%);
  }
}

.app-button__icon {
  display: inline-flex;
  color: currentcolor;
  opacity: 0.8;
}

.app-button__icon :deep(svg) {
  inline-size: 16px;
  block-size: 16px;
}

.app-button--sm .app-button__icon :deep(svg) {
  inline-size: 14px;
  block-size: 14px;
}

/* phones keep the icon and drop the words; the label stays for screen readers */
@media (max-width: 768px) {
  .app-button.is-compact:has(.app-button__icon) {
    padding-inline: 0;
    inline-size: 34px;

    .app-button__text {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  }
}
</style>
