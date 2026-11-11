<script setup lang="ts">
/** One rail entry: icon over label, with an optional count badge. */
import type { RouteLocationRaw } from "vue-router";

defineProps<{
  to?: RouteLocationRaw;
  label: string;
  icon: unknown;
  badge?: number;
  disabled?: boolean;
  disabledHint?: string;
}>();
</script>

<template>
  <RouterLink
    v-if="to && !disabled"
    v-slot="{ href, navigate, isActive, isExactActive }"
    :to="to"
    custom
  >
    <a
      :href="href"
      class="nav-item"
      :class="{ 'is-active': to === '/' ? isExactActive : isActive }"
      :aria-current="
        (to === '/' ? isExactActive : isActive) ? 'page' : undefined
      "
      :title="label"
      @click="navigate"
    >
      <component :is="icon" :size="22" aria-hidden="true" />
      <span class="nav-item__label">{{ label }}</span>
      <span v-if="badge" class="nav-item__badge">{{
        badge > 9 ? "9+" : badge
      }}</span>
    </a>
  </RouterLink>
  <button
    v-else
    type="button"
    class="nav-item"
    :disabled="disabled"
    :title="disabled ? disabledHint : label"
  >
    <component :is="icon" :size="22" aria-hidden="true" />
    <span class="nav-item__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.nav-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  border-radius: var(--radius-xs);
  color: var(--text-tertiary);
  transition: color var(--dur);

  &:hover:not(:disabled) {
    color: var(--text-primary);
  }

  &.is-active {
    color: var(--accent);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.nav-item__label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.nav-item__badge {
  position: absolute;
  inset-block-start: 4px;
  inset-inline-end: 6px;
  min-inline-size: 16px;
  block-size: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--danger);
  color: var(--text-on-media);
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  box-shadow: 0 0 8px var(--danger-glow);
}

@media (max-width: 768px) {
  .nav-item {
    padding: 8px 6px;
  }

  .nav-item__label {
    font-size: 10px;
  }
}
</style>
