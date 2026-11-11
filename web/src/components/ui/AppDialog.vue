<script setup lang="ts">
/**
 * Modal dialog on the native <dialog> element: focus trapping, Escape and
 * top layer stacking come from the browser.
 */
import { shallowRef, watch } from "vue";
import { X } from "@lucide/vue";
import { useT } from "@/composables/useT";

defineProps<{ title: string; width?: string }>();
const open = defineModel<boolean>("open", { required: true });
const { t } = useT(["views/app"]);
const dialog = shallowRef<HTMLDialogElement | null>(null);

watch(
  [open, dialog],
  ([value, el]) => {
    if (!el) return;
    if (value && !el.open) el.showModal();
    else if (!value && el.open) el.close();
  },
  { immediate: true },
);

function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false;
}
</script>

<template>
  <dialog
    ref="dialog"
    class="app-dialog"
    :style="{ inlineSize: width ?? '440px' }"
    @close="open = false"
    @click="onBackdrop"
  >
    <header class="app-dialog__header">
      <h2>{{ title }}</h2>
      <button
        type="button"
        class="app-dialog__close"
        :aria-label="t('dialog.close')"
        @click="open = false"
      >
        <X :size="16" />
      </button>
    </header>
    <div class="app-dialog__body"><slot /></div>
    <footer v-if="$slots.actions" class="app-dialog__actions">
      <slot name="actions" />
    </footer>
  </dialog>
</template>

<style scoped>
.app-dialog {
  max-inline-size: calc(100vw - 32px);
  margin: auto;
  padding: 0;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  box-shadow: var(--shadow-popover);
  opacity: 0;
  scale: 0.97;
  transition:
    opacity var(--dur),
    scale var(--dur) var(--ease),
    display var(--dur) allow-discrete,
    overlay var(--dur) allow-discrete;

  &[open] {
    opacity: 1;
    scale: 1;

    @starting-style {
      opacity: 0;
      scale: 0.97;
    }
  }

  &::backdrop {
    background: var(--backdrop-dialog);
  }
}

.app-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 8px;

  h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
  }
}

.app-dialog__close {
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  border-radius: var(--radius-xs);
  color: var(--text-tertiary);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
}

.app-dialog__body {
  display: grid;
  gap: 14px;
  padding: 8px 18px 16px;
}

.app-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
  border-block-start: 1px solid var(--glass-border);
}
</style>
