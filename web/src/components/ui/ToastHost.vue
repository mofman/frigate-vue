<script setup lang="ts">
/** Stack of transient messages, bottom centre, above everything. */
import { dismissToast, useToasts } from "@/composables/useToast";

const toasts = useToasts();
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="toast"
        :class="`is-${toast.tone}`"
      >
        <button
          type="button"
          class="toast__message"
          @click="dismissToast(toast.id)"
        >
          {{ toast.message }}
        </button>
        <RouterLink
          v-if="toast.action"
          class="toast__action"
          :to="toast.action.to"
          @click="dismissToast(toast.id)"
        >
          {{ toast.action.label }}
        </RouterLink>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  inset-block-end: calc(var(--status-height) + 16px);
  inset-inline: 0;
  z-index: 100;
  display: grid;
  justify-items: center;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  max-inline-size: min(420px, calc(100vw - 32px));
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-popover);
  color: var(--text-primary);
  font-size: var(--text-md);
  pointer-events: auto;

  &.is-success {
    border-color: var(--live-border);
  }

  &.is-error {
    border-color: color-mix(in srgb, var(--danger) 45%, transparent);
  }
}

.toast__message {
  padding: 10px 14px;
  color: inherit;
  font: inherit;
  text-align: start;
}

.toast__action {
  padding: 10px 14px;
  border-inline-start: 1px solid var(--glass-border);
  color: var(--accent-text);
  font-weight: 600;
  white-space: nowrap;

  &:hover {
    color: var(--accent-text-hover);
  }
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--dur),
    translate var(--dur) var(--ease);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  translate: 0 8px;
}
</style>
