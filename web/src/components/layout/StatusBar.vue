<script setup lang="ts">
/** Footer with system metrics, health and the current date and time. */
import { computed } from "vue";
import { Check, TriangleExclamationPoint } from "@lucide/vue";
import { useConfig, useStats } from "@/composables/useFrigate";
import { useNow } from "@/composables/useUtil";
import { useT } from "@/composables/useT";
import {
  formatDateTime,
  formatTime,
  formatUptime,
  resolveTimezone,
} from "@/utils/time";
import StatusChip from "./StatusChip.vue";

const { t } = useT(["views/app"]);
const stats = useStats();
const { data: config } = useConfig();
const now = useNow(1000);

const timezone = computed(() => resolveTimezone(config.value?.ui?.timezone));
const hour12 = computed(() =>
  config.value?.ui?.time_format === "12hour"
    ? true
    : config.value?.ui?.time_format === "24hour"
      ? false
      : undefined,
);

const cpu = computed(() => {
  const value = stats.value?.cpu_usages["frigate.full_system"]?.cpu;
  const parsed = value ? parseInt(value) : NaN;
  return Number.isNaN(parsed) ? undefined : parsed;
});

const gpu = computed(() => {
  const entries = Object.entries(stats.value?.gpu_usages ?? {}).filter(
    ([name]) => name !== "error-gpu",
  );
  return entries
    .map(([, gpu]) => parseInt(gpu.gpu))
    .find((value) => !Number.isNaN(value));
});

const storage = computed(() => {
  const all = stats.value?.service.storage;
  if (!all) return undefined;
  const media =
    all["/media/frigate"] ??
    Object.entries(all).find(([path]) => path !== "/dev/shm")?.[1];
  return media?.total
    ? Math.round((media.used / media.total) * 100)
    : undefined;
});

const uptime = computed(() =>
  stats.value?.service.uptime
    ? formatUptime(stats.value.service.uptime)
    : undefined,
);

const offlineCameras = computed(
  () =>
    Object.entries(stats.value?.cameras ?? {}).filter(
      ([, camera]) => camera.camera_fps === 0,
    ).length,
);
const healthy = computed(
  () => offlineCameras.value === 0 && (storage.value ?? 0) < 90,
);
const healthLabel = computed(() => {
  if (offlineCameras.value > 0) {
    return t("status.camerasOffline", { count: offlineCameras.value });
  }
  if ((storage.value ?? 0) >= 90) return t("status.storageLow");
  return t("status.healthy");
});

const stamp = computed(
  () =>
    `${formatDateTime(now.value, { timezone: timezone.value, hour12: hour12.value }).split(",")[0]} ${formatTime(now.value, { timezone: timezone.value, hour12: hour12.value })}`,
);
</script>

<template>
  <footer class="status-bar">
    <div class="status-bar__metrics">
      <StatusChip
        v-if="cpu !== undefined"
        :label="t('status.cpu')"
        :value="`${cpu}%`"
        :level="cpu"
      />
      <StatusChip
        v-if="gpu !== undefined"
        :label="t('status.gpu')"
        :value="`${gpu}%`"
        :level="gpu"
      />
      <StatusChip
        v-if="storage !== undefined"
        :label="t('status.storage')"
        :value="`${storage}%`"
        :level="storage"
      />
      <StatusChip v-if="uptime" :label="t('status.uptime')" :value="uptime" />
    </div>
    <div class="status-bar__end">
      <span class="system-health" :class="{ 'is-degraded': !healthy }">
        <Check v-if="healthy" :size="14" aria-hidden="true" />
        <TriangleExclamationPoint v-else :size="14" aria-hidden="true" />
        {{ healthLabel }}
      </span>
      <time class="status-bar__time">{{ stamp }}</time>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  grid-area: status;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 20px;
  background: var(--bg-bar);
  border-block-start: 1px solid var(--glass-border);
  z-index: 10;
  overflow: hidden;
}

.status-bar__metrics,
.status-bar__end {
  display: flex;
  align-items: center;
  gap: 10px;
  min-inline-size: 0;
}

.system-health {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--online);

  svg {
    filter: drop-shadow(0 0 4px var(--online-glow));
  }

  &.is-degraded {
    color: var(--warning);

    svg {
      filter: drop-shadow(0 0 4px var(--warning-glow));
    }
  }
}

.status-bar__time {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .status-bar {
    display: none;
  }
}
</style>
