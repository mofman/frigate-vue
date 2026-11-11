<script setup lang="ts">
/**
 * Several metrics over time as lines on a shared axis, with a legend of
 * latest values. Plain SVG scaled to its box; strokes keep their width.
 */
import { computed, shallowRef } from "vue";
import { useTimeOptions } from "@/composables/useFrigate";
import {
  formatValue,
  lastValue,
  linePath,
  niceMax,
  pointIndex,
  type Series,
} from "@/utils/stats";
import { formatTime } from "@/utils/time";

const props = withDefaults(
  defineProps<{
    series: Series[];
    times: number[];
    unit?: string;
    /** short names for the legend, in series order */
    labels?: string[];
    /** fixed axis top, eg 100 for percentages */
    max?: number;
  }>(),
  { unit: "", labels: undefined, max: undefined },
);

const timeOptions = useTimeOptions();
const hover = shallowRef(-1);

const count = computed(() =>
  Math.max(0, ...props.series.map((line) => line.values.length)),
);

const top = computed(() => {
  if (props.max) return props.max;
  const values = props.series.flatMap((line) =>
    line.values.filter((v): v is number => v !== null),
  );
  return niceMax(values);
});

const lines = computed(() =>
  props.series.map((line, index) => ({
    key: line.key,
    name: props.labels?.[index] ?? line.name,
    title: line.name,
    color: `var(--chart-${(index % 8) + 1})`,
    path: linePath(line.values, top.value),
    latest: lastValue(line.values),
  })),
);

function onMove(event: PointerEvent) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  hover.value = pointIndex((event.clientX - box.left) / box.width, count.value);
}

const hoverX = computed(() =>
  count.value > 1 ? (hover.value / (count.value - 1)) * 100 : 0,
);

const tip = computed(() => {
  if (hover.value < 0) return undefined;
  const time = props.times[hover.value];
  return {
    time: time ? formatTime(time, timeOptions.value) : "",
    rows: lines.value.map((line, index) => ({
      ...line,
      value: formatValue(
        props.series[index].values[hover.value] ?? null,
        props.unit,
      ),
    })),
    // keep the tooltip inside the plot near the edges
    side: hoverX.value > 60 ? "end" : "start",
  };
});

const axisTimes = computed(() => {
  const first = props.times[0];
  const last = props.times.at(-1);
  return {
    first: first
      ? formatTime(first, { ...timeOptions.value, seconds: false })
      : "",
    last: last
      ? formatTime(last, { ...timeOptions.value, seconds: false })
      : "",
  };
});
</script>

<template>
  <div class="line-chart">
    <div
      class="line-chart__plot"
      @pointermove="onMove"
      @pointerleave="hover = -1"
    >
      <span class="line-chart__max">{{ formatValue(top, unit) }}</span>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line
          v-for="y in [25, 50, 75]"
          :key="y"
          class="line-chart__grid"
          x1="0"
          x2="100"
          :y1="y"
          :y2="y"
          vector-effect="non-scaling-stroke"
        />
        <path
          v-for="line in lines"
          :key="line.key"
          :d="line.path"
          :style="{ stroke: line.color }"
          vector-effect="non-scaling-stroke"
        />
        <line
          v-if="hover >= 0"
          class="line-chart__cursor"
          :x1="hoverX"
          :x2="hoverX"
          y1="0"
          y2="100"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <div
        v-if="tip"
        class="line-chart__tip"
        :class="`is-${tip.side}`"
        :style="{ '--x': `${hoverX}%` }"
      >
        <span class="line-chart__tip-time">{{ tip.time }}</span>
        <span v-for="row in tip.rows" :key="row.key" class="line-chart__row">
          <i :style="{ background: row.color }" />
          <span class="line-chart__row-name">{{ row.name }}</span>
          <strong>{{ row.value }}</strong>
        </span>
      </div>
    </div>
    <div class="line-chart__axis" aria-hidden="true">
      <span>{{ axisTimes.first }}</span>
      <span>{{ axisTimes.last }}</span>
    </div>
    <ul class="line-chart__legend">
      <li v-for="line in lines" :key="line.key" :title="line.title">
        <i :style="{ background: line.color }" />
        <span class="line-chart__row-name">{{ line.name }}</span>
        <strong>{{ formatValue(line.latest, unit) }}</strong>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.line-chart {
  display: grid;
  gap: 6px;
}

.line-chart__plot {
  position: relative;
  block-size: 120px;
  touch-action: pan-y;

  svg {
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }

  path {
    fill: none;
    stroke-width: 1.75;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
}

.line-chart__grid {
  stroke: var(--chart-grid);
  stroke-width: 1;
}

.line-chart__cursor {
  stroke: var(--line-hover);
  stroke-width: 1;
}

.line-chart__max {
  position: absolute;
  inset: 0 auto auto 0;
  translate: 0 -100%;
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--text-tertiary);
}

.line-chart__axis {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  color: var(--text-tertiary);
}

.line-chart__tip {
  position: absolute;
  inset-block-start: 4px;
  display: grid;
  gap: 3px;
  min-inline-size: 140px;
  max-inline-size: 260px;
  padding: 6px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-popover);
  font-size: var(--text-xs);
  pointer-events: none;
  z-index: 2;

  &.is-start {
    left: calc(var(--x) + 8px);
  }

  &.is-end {
    right: calc(100% - var(--x) + 8px);
  }
}

.line-chart__tip-time {
  color: var(--text-tertiary);
}

.line-chart__row,
.line-chart__legend li {
  display: flex;
  align-items: center;
  gap: 6px;
  min-inline-size: 0;

  i {
    flex-shrink: 0;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 2px;
  }

  strong {
    margin-inline-start: auto;
    font-family: var(--font-mono);
    font-weight: 500;
  }
}

.line-chart__row-name {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}

.line-chart__legend {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 4px 14px;
  font-size: var(--text-sm);

  strong {
    color: var(--text-primary);
  }
}
</style>
