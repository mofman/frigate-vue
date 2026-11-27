<script setup lang="ts">
/** Progress through a multi step flow, naming the current step. */
defineProps<{ steps: string[]; current: number }>();
</script>

<template>
  <div class="step-indicator">
    <ol class="step-indicator__track">
      <li
        v-for="(step, index) in steps"
        :key="step"
        class="step-indicator__step"
        :class="{ 'is-done': index <= current }"
        :aria-current="index === current ? 'step' : undefined"
        :aria-label="step"
      />
    </ol>
    <span class="step-indicator__label">{{ steps[current] }}</span>
  </div>
</template>

<style scoped>
.step-indicator {
  display: grid;
  gap: 8px;
}

.step-indicator__track {
  display: flex;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step-indicator__step {
  flex: 1;
  block-size: 3px;
  border-radius: var(--radius-pill);
  background: var(--bg-hover);
  transition: background var(--dur);

  &.is-done {
    background: var(--accent-strong);
  }
}

.step-indicator__label {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}
</style>
