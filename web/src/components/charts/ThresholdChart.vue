<script setup lang="ts">
/**
 * One metric over time as bars colored by its warning and error lines, with
 * the latest value in the header. Plain SVG; hover shows the point's value.
 */
import { computed, shallowRef } from "vue";
import { useTimeOptions } from "@/composables/useFrigate";
import type { Threshold } from "@/types/stats";
import {
  formatValue,
  lastValue,
  niceMax,
  pointIndex,
  thresholdLevel,
} from "@/utils/stats";
import { formatTime } from "@/utils/time";

const props = defineProps<{
  name: string;
  unit: string;
  values: (number | null)[];
  times: number[];
  threshold: Threshold;
}>();

const timeOptions = useTimeOptions();
const hover = shallowRef(-1);

const latest = computed(() => lastValue(props.values));
const level = computed(() => thresholdLevel(latest.value, props.threshold));

const max = computed(() => {
  const values = props.values.filter((v): v is number => v !== null);
  const top = niceMax(values, props.threshold.warning);
  return props.unit === "%" ? Math.min(top, 100) || 100 : top;
});

const bars = computed(() => {
  return props.values.map((value, index) => {
    const height =
      value === null ? 0 : (Math.min(value, max.value) / max.value) * 100;
    return {
      index,
      x: index + 0.15,
      width: 0.7,
      y: 100 - height,
      height,
      level: thresholdLevel(value, props.threshold),
    };
  });
});

const warningY = computed(
  () => 100 - (Math.min(props.threshold.warning, max.value) / max.value) * 100,
);

function onMove(event: PointerEvent) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  hover.value = pointIndex(
    (event.clientX - box.left) / box.width,
    props.values.length,
    true,
  );
}

const tip = computed(() => {
  if (hover.value < 0) return undefined;
  const time = props.times[hover.value];
  return {
    left: `${((hover.value + 0.5) / props.values.length) * 100}%`,
    value: formatValue(props.values[hover.value] ?? null, props.unit),
    time: time ? formatTime(time, timeOptions.value) : "",
  };
});
</script>

<template>
  <div class="threshold-chart">
    <div class="threshold-chart__head">
      <span class="threshold-chart__name">{{ name }}</span>
      <span class="threshold-chart__value" :class="`is-${level}`">{{
        formatValue(latest, unit)
      }}</span>
    </div>
    <div
      class="threshold-chart__plot"
      @pointermove="onMove"
      @pointerleave="hover = -1"
    >
      <svg
        :viewBox="`0 0 ${Math.max(values.length, 1)} 100`"
        preserveAspectRatio="none"
        role="img"
        :aria-label="`${name}: ${formatValue(latest, unit)}`"
      >
        <line
          class="threshold-chart__warning"
          x1="0"
          :x2="values.length"
          :y1="warningY"
          :y2="warningY"
          vector-effect="non-scaling-stroke"
        />
        <rect
          v-for="bar in bars"
          :key="bar.index"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
          :class="[`is-${bar.level}`, { 'is-hover': bar.index === hover }]"
        />
      </svg>
      <div v-if="tip" class="threshold-chart__tip" :style="{ left: tip.left }">
        <strong>{{ tip.value }}</strong>
        <span>{{ tip.time }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.threshold-chart {
  display: grid;
  gap: 6px;
}

.threshold-chart__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  font-size: var(--text-sm);
}

.threshold-chart__name {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.threshold-chart__value {
  font-family: var(--font-mono);
  font-weight: 500;
  color: var(--text-primary);

  &.is-warning {
    color: var(--warning);
  }

  &.is-error {
    color: var(--danger);
  }
}

.threshold-chart__plot {
  position: relative;
  block-size: 56px;
  touch-action: pan-y;

  svg {
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }

  rect {
    fill: var(--chart-ok);
    opacity: 0.75;

    &.is-warning {
      fill: var(--warning);
    }

    &.is-error {
      fill: var(--danger);
    }

    &.is-hover {
      opacity: 1;
    }
  }
}

.threshold-chart__warning {
  stroke: var(--warning);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  opacity: 0.35;
}

.threshold-chart__tip {
  position: absolute;
  inset-block-end: calc(100% + 6px);
  translate: -50% 0;
  display: grid;
  gap: 1px;
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-popover);
  font-size: var(--text-xs);
  white-space: nowrap;
  pointer-events: none;
  z-index: 2;

  strong {
    font-family: var(--font-mono);
    font-weight: 500;
  }

  span {
    color: var(--text-tertiary);
  }
}
</style>
