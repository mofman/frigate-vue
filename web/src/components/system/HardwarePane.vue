<script setup lang="ts">
/**
 * Health > Hardware: whether detection, hardware decoding and enrichments run
 * where the config asks, and which cameras connect poorly.
 */
import { computed } from "vue";
import { RefreshCw } from "@lucide/vue";
import { useHardwareHealth } from "@/composables/useHealth";
import { useTimeOptions } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { HardwareRow } from "@/types/health";
import { formatTime } from "@/utils/time";
import AppButton from "@/components/ui/AppButton.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import MetricCard from "./MetricCard.vue";

const { t } = useT(["views/system"]);
const { rows, rechecking, probedAt, recheck } = useHardwareHealth();
const timeOptions = useTimeOptions();

const groups = computed<{ key: string; title: string; rows: HardwareRow[] }[]>(
  () =>
    rows.value
      ? [
          {
            key: "detection",
            title: t("health.hardware.objectDetection"),
            rows: rows.value.detection,
          },
          {
            key: "hwaccel",
            title: t("health.hardware.hardwareAcceleration"),
            rows: rows.value.hwaccel,
          },
          {
            key: "enrichments",
            title: t("health.hardware.enrichments.title"),
            rows: rows.value.enrichments,
          },
        ].filter((group) => group.key !== "enrichments" || group.rows.length)
      : [],
);

const qualityTone = {
  fair: "warning",
  poor: "error",
  unusable: "error",
} as const;
</script>

<template>
  <MetricCard :title="t('health.hardware.title')">
    <template #actions>
      <span v-if="probedAt" class="hardware__probed">
        {{ t("health.hardware.probed") }}
        {{ formatTime(probedAt, { ...timeOptions, seconds: false }) }}
      </span>
      <AppButton size="sm" :disabled="rechecking" @click="recheck">
        <template #icon
          ><RefreshCw :class="{ 'is-spinning': rechecking }"
        /></template>
        {{
          rechecking
            ? t("health.hardware.probing")
            : t("health.hardware.recheck")
        }}
      </AppButton>
    </template>

    <div v-if="!rows" class="hardware__loading"><LoadingSpinner /></div>
    <template v-else>
      <section v-for="group in groups" :key="group.key" class="hardware__group">
        <h4>{{ group.title }}</h4>
        <p v-if="!group.rows.length" class="hardware__empty">
          {{ t("health.hardware.nothingConfigured") }}
        </p>
        <ul>
          <li
            v-for="row in group.rows"
            :key="row.id"
            class="hardware__row"
            :class="`is-${row.state}`"
          >
            <span class="hardware__dot" aria-hidden="true" />
            <div>
              <p>
                <strong>{{ row.label }}</strong>
                <span v-if="row.detail" class="hardware__detail">
                  {{ row.detail }}</span
                >
              </p>
              <p v-if="row.message" class="hardware__message">
                {{ row.message }}
              </p>
            </div>
          </li>
        </ul>
      </section>

      <section class="hardware__group">
        <h4>{{ t("health.hardware.cameraConnections") }}</h4>
        <p v-if="!rows.cameras.length" class="hardware__empty">
          {{ t("health.hardware.allCamerasExcellent") }}
        </p>
        <ul v-else class="hardware__cameras">
          <li
            v-for="cell in rows.cameras"
            :key="cell.camera"
            class="hardware__row"
            :class="`is-${qualityTone[cell.quality as keyof typeof qualityTone] ?? 'ok'}`"
          >
            <span class="hardware__dot" aria-hidden="true" />
            <div>
              <p>
                <strong class="hardware__camera">{{ cell.label }}</strong>
                <span class="hardware__detail">
                  {{ t(`cameras.connectionQuality.${cell.quality}`) }}</span
                >
              </p>
              <p class="hardware__message">
                {{
                  t("health.hardware.fps", {
                    camera: cell.cameraFps,
                    expected: cell.expectedFps,
                  })
                }}
              </p>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </MetricCard>
</template>

<style scoped>
.hardware__loading {
  display: grid;
  place-items: center;
  min-block-size: 80px;
}

.hardware__probed {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}

.is-spinning {
  animation: spin 1s linear infinite;
}

.hardware__group {
  display: grid;
  gap: 6px;

  h4 {
    font-size: var(--text-xs);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-tertiary);
  }

  ul {
    display: grid;
  }
}

.hardware__cameras {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.hardware__empty {
  font-size: var(--text-md);
  color: var(--text-secondary);
}

.hardware__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  padding: 7px 2px;
  font-size: var(--text-md);
  --tone: var(--chart-ok);

  &.is-warning {
    --tone: var(--warning);
  }

  &.is-error {
    --tone: var(--danger);
  }

  &.is-unknown {
    --tone: var(--text-tertiary);
  }

  strong {
    font-weight: 600;
  }
}

.hardware__dot {
  inline-size: 8px;
  block-size: 8px;
  margin-block-start: 6px;
  border-radius: 50%;
  background: var(--tone);
  box-shadow: 0 0 6px color-mix(in srgb, var(--tone), transparent 50%);
}

.hardware__detail {
  color: var(--text-tertiary);

  &::before {
    content: " · ";
  }
}

.hardware__camera {
  text-transform: capitalize;
}

.hardware__message {
  font-size: var(--text-sm);
  color: var(--tone);

  .is-unknown & {
    color: var(--text-secondary);
  }
}
</style>
