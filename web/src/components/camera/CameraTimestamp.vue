<script setup lang="ts">
/** Ticking wall clock badge in the corner of a feed. */
import { computed } from "vue";
import { useConfig } from "@/composables/useFrigate";
import { useNow } from "@/composables/useUtil";
import { formatTime, resolveTimezone } from "@/utils/time";

const props = withDefaults(
  defineProps<{ time?: number; size?: "sm" | "md" }>(),
  { time: undefined, size: "sm" },
);
const { data: config } = useConfig();
const now = useNow(1000);

const label = computed(() =>
  formatTime(props.time ?? now.value, {
    timezone: resolveTimezone(config.value?.ui?.timezone),
    hour12:
      config.value?.ui?.time_format === "12hour"
        ? true
        : config.value?.ui?.time_format === "24hour"
          ? false
          : undefined,
  }),
);
</script>

<template>
  <time class="camera-time" :class="`camera-time--${size}`">{{ label }}</time>
</template>

<style scoped>
.camera-time {
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--bg-chip-on-media);
  backdrop-filter: blur(4px);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-on-media-faint);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.camera-time--md {
  display: inline-flex;
  align-items: center;
  block-size: 26px;
  padding-inline: 9px;
  border: 1px solid var(--line-overlay);
  background: var(--bg-overlay-control);
  backdrop-filter: blur(12px);
  font-size: var(--text-sm);
  color: var(--text-on-media-muted);
}
</style>
