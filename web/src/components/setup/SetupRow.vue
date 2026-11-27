<script setup lang="ts">
/** A named row with its status or action at the end. */
defineProps<{ label: string; detail?: string }>();
</script>

<template>
  <div class="setup-row">
    <span class="setup-row__text">
      <span class="setup-row__label">{{ label }}</span>
      <span v-if="detail" class="setup-row__detail">{{ detail }}</span>
    </span>
    <span class="setup-row__end"><slot /></span>
  </div>
</template>

<style scoped>
.setup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-block-size: 44px;
  padding: 8px 12px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
}

.setup-row__text {
  display: grid;
  gap: 2px;
  min-inline-size: 0;
}

.setup-row__label {
  overflow-wrap: anywhere;
  font-size: var(--text-md);
  font-weight: 500;
}

.setup-row__detail {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.setup-row__end {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.setup-row__end :deep(svg.is-ok) {
  color: var(--live);
}
</style>
