<script setup lang="ts">
/** Bordered group inside an Add Camera step, with an optional connection state. */
import { CircleCheck, X } from "@lucide/vue";

defineProps<{
  title?: string;
  summary?: string;
  /** undefined shows no state */
  connected?: boolean;
  connectedLabel?: string;
  disconnectedLabel?: string;
}>();
</script>

<template>
  <section class="wizard-panel">
    <header v-if="title || $slots.actions" class="wizard-panel__header">
      <div class="wizard-panel__heading">
        <h3 v-if="title">{{ title }}</h3>
        <slot name="heading-extra" />
        <p v-if="summary">{{ summary }}</p>
      </div>
      <div class="wizard-panel__end">
        <span v-if="connected === true" class="wizard-panel__state is-ok">
          <CircleCheck :size="14" />{{ connectedLabel }}
        </span>
        <span
          v-else-if="connected === false"
          class="wizard-panel__state is-bad"
        >
          <X :size="14" />{{ disconnectedLabel }}
        </span>
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.wizard-panel {
  display: grid;
  gap: 12px;
  min-inline-size: 0;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--bg-surface);
}

.wizard-panel__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.wizard-panel__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  min-inline-size: 0;

  h3 {
    margin: 0;
    font-size: var(--text-md);
    font-weight: 600;
  }

  p {
    flex-basis: 100%;
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
}

.wizard-panel__end {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wizard-panel__state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-sm);

  &.is-ok {
    color: var(--live);
  }

  &.is-bad {
    color: var(--danger);
  }
}
</style>
