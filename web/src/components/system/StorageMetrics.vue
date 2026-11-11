<script setup lang="ts">
/**
 * System > Storage: recordings, cache and shared memory, then how the
 * recordings disk splits between cameras.
 */
import { computed } from "vue";
import { useQuery } from "@/api/query";
import {
  cameraLabel,
  useConfig,
  useStats,
  useTimeOptions,
} from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { CameraStorage, StreamStorage } from "@/types/stats";
import { formatMiB } from "@/utils/stats";
import UsageBar from "@/components/charts/UsageBar.vue";
import InfoTip from "@/components/ui/InfoTip.vue";
import MetricCard from "./MetricCard.vue";
import SystemSection from "./SystemSection.vue";

const DOCS_SHM =
  "https://docs.frigate.video/frigate/installation#calculating-required-shm-size";

const { t } = useT(["views/system", "common", "components/player"]);
const stats = useStats();
const { data: config } = useConfig();
const timeOptions = useTimeOptions();

const { data: cameraStorage } = useQuery<CameraStorage>("recordings/storage", {
  revalidateOnFocus: false,
  staleTime: 30_000,
});
const { data: summary } = useQuery<Record<string, unknown>>(
  () => ["recordings/summary", { timezone: timeOptions.value.timezone }],
  { revalidateOnFocus: false, staleTime: 60_000 },
);

const storage = computed(() => stats.value?.service.storage ?? {});
const recordings = computed(() => storage.value["/media/frigate/recordings"]);
const cache = computed(() => storage.value["/tmp/cache"]);
const shm = computed(() => storage.value["/dev/shm"]);

const cameraTotal = computed(() =>
  Object.values(cameraStorage.value ?? {}).reduce(
    (sum, camera) => sum + (camera.usage ?? 0),
    0,
  ),
);

const earliest = computed(() => {
  const days = Object.keys(summary.value ?? {}).sort();
  if (!days.length) return undefined;
  return new Intl.DateTimeFormat(navigator.language, {
    dateStyle: "medium",
  }).format(new Date(`${days[0]}T00:00:00`));
});

const shmTooSmall = computed(
  () => !!shm.value && shm.value.total < (shm.value.min_shm ?? 0),
);

/** how long a frame survives in shared memory at the fastest camera's rate */
const frameLifetime = computed(() => {
  const frames = shm.value?.shm_frame_count;
  if (!frames || !stats.value || !config.value) return undefined;
  const fastest = Math.max(
    0,
    ...Object.entries(stats.value.cameras)
      .filter(([name]) => config.value?.cameras[name]?.enabled)
      .map(([, camera]) => camera.camera_fps),
  );
  if (!fastest) return undefined;
  return { frames, lifetime: Math.round((frames / fastest) * 10) / 10 };
});

type Row = {
  key: string;
  name: string;
  usage: number;
  bandwidth?: number;
  color: string;
  streams?: { main?: StreamStorage; sub?: StreamStorage };
  aggregate?: boolean;
};

const rows = computed<Row[]>(() => {
  const disk = recordings.value;
  if (!cameraStorage.value || !disk) return [];
  const cameras = Object.entries(cameraStorage.value)
    .sort(([, a], [, b]) => b.usage - a.usage)
    .map(([name, camera], index) => ({
      key: name,
      name: cameraLabel(config.value?.cameras[name], name),
      usage: camera.usage ?? 0,
      bandwidth: camera.bandwidth,
      color: `var(--chart-${(index % 8) + 1})`,
      streams: camera.streams,
    }));
  return [
    ...cameras,
    {
      key: "other",
      name: t("storage.cameraStorage.other"),
      usage: Math.max(0, disk.used - cameraTotal.value),
      color: "var(--chart-other)",
      aggregate: true,
    },
    {
      key: "unused",
      name: t("storage.cameraStorage.unused.title"),
      usage: Math.max(0, disk.total - disk.used),
      color: "var(--chart-unused)",
      aggregate: true,
    },
  ];
});

const hasSubStreams = computed(() =>
  rows.value.some((row) => row.streams?.sub),
);

const percent = (usage: number) =>
  recordings.value?.total ? (usage / recordings.value.total) * 100 : 0;
</script>

<template>
  <SystemSection :title="t('storage.overview')" :loading="!stats">
    <MetricCard v-if="recordings" :title="t('storage.recordings.title')">
      <template #actions>
        <InfoTip :label="t('storage.recordings.title')">
          {{ t("storage.recordings.tips") }}
        </InfoTip>
      </template>
      <UsageBar :used="cameraTotal" :total="recordings.total" />
      <p v-if="earliest" class="storage-note">
        <strong>{{ t("storage.recordings.earliestRecording") }}</strong>
        {{ earliest }}
      </p>
    </MetricCard>
    <MetricCard v-if="cache" title="/tmp/cache">
      <UsageBar :used="cache.used" :total="cache.total" />
    </MetricCard>
    <MetricCard v-if="shm" title="/dev/shm">
      <template #actions>
        <InfoTip
          v-if="frameLifetime"
          :label="t('storage.shm.frameLifetime.title')"
        >
          {{
            t("storage.shm.frameLifetime.description", {
              frames: frameLifetime.frames,
              lifetime: frameLifetime.lifetime,
            })
          }}
        </InfoTip>
        <InfoTip
          v-if="shmTooSmall"
          tone="danger"
          :label="t('storage.shm.title')"
        >
          {{
            t("storage.shm.warning", {
              total: shm.total,
              min_shm: shm.min_shm,
            })
          }}
          <a :href="DOCS_SHM" target="_blank" rel="noopener noreferrer">{{
            t("common:readTheDocumentation")
          }}</a>
        </InfoTip>
      </template>
      <UsageBar :used="shm.used" :total="shm.total" />
    </MetricCard>
  </SystemSection>

  <SystemSection
    v-if="rows.length && recordings"
    :title="t('storage.cameraStorage.title')"
    min="100%"
  >
    <MetricCard
      :title="`${formatMiB(cameraTotal)} / ${formatMiB(recordings.total)}`"
    >
      <div class="storage-stack" aria-hidden="true">
        <span
          v-for="row in rows"
          :key="row.key"
          :style="{
            inlineSize: `${percent(row.usage)}%`,
            background: row.color,
          }"
          :title="row.name"
        />
      </div>
      <div class="storage-table-wrap">
        <table class="storage-table">
          <thead>
            <tr>
              <th>{{ t("storage.cameraStorage.camera") }}</th>
              <th>
                <span class="storage-table__th">
                  {{ t("storage.cameraStorage.storageUsed") }}
                  <InfoTip
                    v-if="hasSubStreams"
                    :label="t('storage.cameraStorage.subStream.information')"
                  >
                    {{ t("storage.cameraStorage.subStream.tips") }}
                  </InfoTip>
                </span>
              </th>
              <th>{{ t("storage.cameraStorage.percentageOfTotalUsed") }}</th>
              <th>{{ t("storage.cameraStorage.bandwidth") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.key">
              <td>
                <span class="storage-table__name">
                  <i :style="{ background: row.color }" />
                  {{ row.name }}
                  <InfoTip
                    v-if="row.aggregate"
                    :label="t('storage.cameraStorage.unusedStorageInformation')"
                  >
                    {{ t("storage.cameraStorage.unused.tips") }}
                  </InfoTip>
                </span>
              </td>
              <td>
                {{ formatMiB(row.usage) }}
                <span v-if="row.streams?.sub" class="storage-table__split">
                  {{ t("components/player:quality.main") }}
                  {{ formatMiB(row.streams.main?.usage) }} ·
                  {{ t("components/player:quality.sub") }}
                  {{ formatMiB(row.streams.sub.usage) }}
                </span>
              </td>
              <td>{{ percent(row.usage).toFixed(2) }}%</td>
              <td>
                {{
                  row.aggregate || row.bandwidth === undefined
                    ? "-"
                    : `${formatMiB(row.bandwidth)} / h`
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </MetricCard>
  </SystemSection>
</template>

<style scoped>
.storage-note {
  font-size: var(--text-sm);
  color: var(--text-secondary);

  strong {
    font-weight: 600;
  }
}

.storage-stack {
  display: flex;
  block-size: 14px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--chart-unused);

  span {
    block-size: 100%;
    min-inline-size: 0;
  }

  span + span {
    border-inline-start: 1px solid var(--bg-elevated);
  }
}

.storage-table-wrap {
  overflow-x: auto;
}

.storage-table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: var(--text-md);

  th,
  td {
    padding: 8px 10px;
    text-align: start;
    vertical-align: middle;
    border-block-end: 1px solid var(--glass-border);
    white-space: nowrap;
  }

  th {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }

  td {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  tr:last-child td {
    border-block-end: none;
  }
}

.storage-table__th {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.storage-table__name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: 500;
  color: var(--text-primary);
  text-transform: capitalize;

  i {
    inline-size: 10px;
    block-size: 10px;
    border-radius: 3px;
  }
}

.storage-table__split {
  display: block;
  margin-block-start: 2px;
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
</style>
