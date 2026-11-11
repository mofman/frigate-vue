<script setup lang="ts">
/** Small info (or warning) icon that opens an explanation on click. */
import { CircleAlert, Info } from "@lucide/vue";
import PopoverMenu from "./PopoverMenu.vue";

withDefaults(defineProps<{ label: string; tone?: "info" | "danger" }>(), {
  tone: "info",
});
</script>

<template>
  <PopoverMenu width="300px">
    <template #trigger="{ popovertarget }">
      <button
        type="button"
        class="info-tip"
        :class="`is-${tone}`"
        :popovertarget="popovertarget"
        :aria-label="label"
        :title="label"
      >
        <CircleAlert v-if="tone === 'danger'" :size="16" aria-hidden="true" />
        <Info v-else :size="16" aria-hidden="true" />
      </button>
    </template>
    <div class="info-tip__body"><slot /></div>
  </PopoverMenu>
</template>

<style scoped>
.info-tip {
  display: inline-grid;
  place-items: center;
  inline-size: 24px;
  block-size: 24px;
  border-radius: var(--radius-xs);
  color: var(--text-tertiary);

  &:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }

  &.is-danger {
    color: var(--danger);
  }
}

.info-tip__body {
  display: grid;
  gap: 8px;
  padding: 6px 8px;
  font-size: var(--text-md);
  line-height: 1.5;
  color: var(--text-secondary);
}
</style>
