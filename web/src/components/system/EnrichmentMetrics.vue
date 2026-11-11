<script setup lang="ts">
/**
 * System > Enrichments: per enrichment inference time and, where reported,
 * inferences per second. Keys follow `{name}_speed` and
 * `{name}_events_per_second`; GenAI descriptions report milliseconds and are
 * shown in seconds.
 */
import { computed } from "vue";
import { useStatsHistory } from "@/composables/useStatsHistory";
import { useT } from "@/composables/useT";
import { EmbeddingThreshold, GenAIThreshold } from "@/types/stats";
import { toNumber, type Series } from "@/utils/stats";
import LineChart from "@/components/charts/LineChart.vue";
import ThresholdChart from "@/components/charts/ThresholdChart.vue";
import MetricCard from "./MetricCard.vue";
import SystemSection from "./SystemSection.vue";

const props = defineProps<{ active: boolean }>();
const { t } = useT(["views/system"]);

const { history, times } = useStatsHistory(
  "embeddings,service.last_updated",
  () => props.active,
);

type Group = {
  key: string;
  title: string;
  unit: string;
  speed?: Series;
  rate?: Series;
};

function categoryTitle(category: string) {
  if (category.endsWith("_classification")) {
    return t("enrichments.embeddings.classification", {
      name: category.replace(/_classification$/, ""),
    });
  }
  return t(`enrichments.embeddings.${category}`, { defaultValue: category });
}

const groups = computed<Group[]>(() => {
  const found = new Map<string, Group>();
  const count = history.value.length;

  history.value.forEach((stats, index) => {
    for (const [key, raw] of Object.entries(stats.embeddings ?? {})) {
      // embeddings.devices maps enrichments to devices, it is not a metric
      if (typeof raw !== "number") continue;
      const isSpeed = key.endsWith("_speed");
      const isRate = key.endsWith("_events_per_second");
      if (!isSpeed && !isRate) continue;
      const category = key.replace(/_(speed|events_per_second)$/, "");
      const seconds = category.includes("description");
      let group = found.get(category);
      if (!group) {
        group = {
          key: category,
          title: categoryTitle(category),
          unit: seconds ? "s" : "ms",
        };
        found.set(category, group);
      }
      const slot = isSpeed ? "speed" : "rate";
      group[slot] ??= { key, name: key, values: Array(count).fill(null) };
      const value = toNumber(raw);
      group[slot].values[index] =
        value !== null && isSpeed && seconds ? value / 1000 : value;
    }
  });

  return [...found.values()];
});
</script>

<template>
  <SystemSection
    :title="t('enrichments.title')"
    min="280px"
    :loading="!history.length"
  >
    <MetricCard v-for="group in groups" :key="group.key" :title="group.title">
      <ThresholdChart
        v-if="group.speed"
        :name="t('enrichments.averageInf')"
        :values="group.speed.values"
        :times="times"
        :unit="group.unit"
        :threshold="group.unit === 's' ? GenAIThreshold : EmbeddingThreshold"
      />
      <LineChart
        v-if="group.rate"
        :series="[{ ...group.rate, name: t('enrichments.infPerSecond') }]"
        :times="times"
      />
    </MetricCard>
  </SystemSection>
</template>
