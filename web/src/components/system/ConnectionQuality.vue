<script setup lang="ts">
/** A camera's connection quality as a pill, with the numbers behind it. */
import { computed } from "vue";
import { useT } from "@/composables/useT";
import type { CameraStats } from "@/types/stats";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";

const props = defineProps<{ stats: CameraStats }>();
const { t } = useT(["views/system"]);

const quality = computed(() => props.stats.connection_quality ?? "excellent");
const tone = computed(
  () =>
    ({ excellent: "ok", fair: "warning", poor: "error", unusable: "error" })[
      quality.value
    ],
);
const label = computed(() => t(`cameras.connectionQuality.${quality.value}`));
</script>

<template>
  <PopoverMenu width="240px">
    <template #trigger="{ popovertarget }">
      <button
        type="button"
        class="quality"
        :class="`is-${tone}`"
        :popovertarget="popovertarget"
        :aria-label="`${t('cameras.connectionQuality.title')}: ${label}`"
      >
        <span class="quality__dot" aria-hidden="true" />
        {{ label }}
      </button>
    </template>
    <div class="quality__details">
      <strong>{{ t("cameras.connectionQuality.title") }}</strong>
      <dl>
        <dt>{{ t("cameras.connectionQuality.fps") }}</dt>
        <dd>{{ stats.camera_fps }}</dd>
        <dt>{{ t("cameras.connectionQuality.expectedFps") }}</dt>
        <dd>{{ stats.expected_fps ?? "-" }}</dd>
        <dt>{{ t("cameras.connectionQuality.reconnectsLastHour") }}</dt>
        <dd>{{ stats.reconnects_last_hour ?? 0 }}</dd>
        <dt>{{ t("cameras.connectionQuality.stallsLastHour") }}</dt>
        <dd>{{ stats.stalls_last_hour ?? 0 }}</dd>
      </dl>
    </div>
  </PopoverMenu>
</template>

<style scoped>
.quality {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  block-size: 24px;
  padding-inline: 10px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--text-secondary);
  --dot: var(--chart-ok);

  &.is-warning {
    --dot: var(--warning);
  }

  &.is-error {
    --dot: var(--danger);
  }

  &:hover {
    border-color: var(--line-hover);
  }
}

.quality__dot {
  inline-size: 6px;
  block-size: 6px;
  border-radius: 50%;
  background: var(--dot);
  box-shadow: 0 0 6px var(--dot);
}

.quality__details {
  display: grid;
  gap: 8px;
  padding: 6px 8px;
  font-size: var(--text-md);

  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
  }

  dt {
    color: var(--text-tertiary);
  }

  dd {
    font-family: var(--font-mono);
    text-align: end;
  }
}
</style>
