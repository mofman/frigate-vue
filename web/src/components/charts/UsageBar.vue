<script setup lang="ts">
/** Used of total as a labelled bar, eg disk space. Sizes are MiB. */
import { computed } from "vue";
import { formatMiB } from "@/utils/stats";

const props = defineProps<{ used: number; total: number }>();

const percent = computed(() =>
  props.total > 0 ? Math.min(100, (props.used / props.total) * 100) : 0,
);
const tone = computed(() =>
  percent.value >= 90 ? "error" : percent.value >= 75 ? "warning" : "ok",
);
</script>

<template>
  <div class="usage-bar">
    <div class="usage-bar__labels">
      <span>
        <strong>{{ formatMiB(used) }}</strong>
        <span class="usage-bar__total"> / {{ formatMiB(total) }}</span>
      </span>
      <span class="usage-bar__percent">{{ Math.round(percent) }}%</span>
    </div>
    <div
      class="usage-bar__track"
      role="meter"
      :aria-valuenow="Math.round(percent)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div
        class="usage-bar__fill"
        :class="`is-${tone}`"
        :style="{ inlineSize: `${percent}%` }"
      />
    </div>
  </div>
</template>

<style scoped>
.usage-bar {
  display: grid;
  gap: 8px;
}

.usage-bar__labels {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--text-sm);

  strong {
    font-weight: 600;
  }
}

.usage-bar__total,
.usage-bar__percent {
  color: var(--text-tertiary);
  font-family: var(--font-mono);
}

.usage-bar__track {
  block-size: 10px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--chart-unused);
}

.usage-bar__fill {
  block-size: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: inline-size var(--dur) var(--ease);

  &.is-warning {
    background: var(--warning);
  }

  &.is-error {
    background: var(--danger);
  }
}
</style>
