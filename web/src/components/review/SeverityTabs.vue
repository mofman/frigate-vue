<script setup lang="ts">
/** Alerts / detections switcher with unreviewed counts. */
import type { ReviewSeverity } from "@/types/frigate";
import { useT } from "@/composables/useT";

defineProps<{ counts: Partial<Record<ReviewSeverity, number>> }>();
const model = defineModel<ReviewSeverity>({ required: true });
const { t } = useT(["views/app", "views/events"]);

const tabs: { value: ReviewSeverity; key: string }[] = [
  { value: "alert", key: "views/events:alerts" },
  { value: "detection", key: "views/events:detections" },
];
</script>

<template>
  <div class="severity-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      role="tab"
      class="severity-tabs__tab"
      :class="[`is-${tab.value}`, { 'is-active': model === tab.value }]"
      :aria-selected="model === tab.value"
      @click="model = tab.value"
    >
      <span class="severity-tabs__marker" aria-hidden="true" />
      {{ t(tab.key) }}
      <span v-if="counts[tab.value]" class="severity-tabs__count">{{
        counts[tab.value]
      }}</span>
    </button>
  </div>
</template>

<style scoped>
.severity-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-deep);
}

.severity-tabs__tab {
  --tone: var(--accent);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  block-size: 28px;
  padding-inline: 12px;
  border-radius: var(--radius-xs);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-tertiary);
  transition:
    color var(--dur),
    background var(--dur);

  &.is-alert {
    --tone: var(--warning);
  }

  &:hover {
    color: var(--text-secondary);
  }

  &.is-active {
    background: var(--bg-surface);
    color: var(--text-primary);
  }
}

.severity-tabs__marker {
  inline-size: 6px;
  block-size: 6px;
  border-radius: 50%;
  background: var(--tone);
  box-shadow: 0 0 6px var(--tone);
}

.severity-tabs__count {
  min-inline-size: 18px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--tone) 18%, transparent);
  color: var(--tone);
  font-size: var(--text-2xs);
  font-weight: 600;
  line-height: 16px;
}
</style>
