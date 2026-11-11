<script setup lang="ts">
/** System > General: detectors, GPUs / NPUs and Frigate's own processes. */
import { computed, shallowRef } from "vue";
import { useStatsHistory } from "@/composables/useStatsHistory";
import { useT } from "@/composables/useT";
import {
  DetectorCpuThreshold,
  DetectorMemThreshold,
  DetectorTempThreshold,
  GpuMemThreshold,
  GpuUsageThreshold,
  InferenceThreshold,
  type FrigateStats,
  type GpuInfoKind,
  type GpuStats,
  type Threshold,
} from "@/types/stats";
import { collectSeries, type Series } from "@/utils/stats";
import ThresholdChart from "@/components/charts/ThresholdChart.vue";
import AppButton from "@/components/ui/AppButton.vue";
import InfoTip from "@/components/ui/InfoTip.vue";
import MetricCard from "./MetricCard.vue";
import SystemSection from "./SystemSection.vue";
import GpuInfoDialog from "./GpuInfoDialog.vue";

const props = defineProps<{ active: boolean }>();
const { t } = useT(["views/system"]);

const { history, times } = useStatsHistory(
  "detectors.inference_speed,detectors.temperature,detectors.cpu,detectors.mem,gpu_usages,npu_usages,processes.cpu,processes.mem,service.last_updated",
  () => props.active,
);

type Card = {
  id: string;
  title: string;
  unit: string;
  threshold: Threshold;
  series: Series[];
  info?: string;
};

const detectors = (stats: FrigateStats) => stats.detectors;
const gpus = (stats: FrigateStats) => stats.gpu_usages;
const npus = (stats: FrigateStats) => stats.npu_usages;
const processes = (stats: FrigateStats) => stats.processes;

const detectorCards = computed<Card[]>(() => [
  {
    id: "inference",
    title: t("general.detector.inferenceSpeed"),
    unit: "ms",
    threshold: InferenceThreshold,
    series: collectSeries(history.value, detectors, (d) => d.inference_speed),
  },
  {
    id: "temperature",
    title: t("general.detector.temperature"),
    unit: "°C",
    threshold: DetectorTempThreshold,
    series: collectSeries(history.value, detectors, (d) =>
      d.temperature === undefined ? null : Math.round(d.temperature),
    ),
  },
  {
    id: "cpu",
    title: t("general.detector.cpuUsage"),
    unit: "%",
    threshold: DetectorCpuThreshold,
    series: collectSeries(history.value, detectors, (d) => d.cpu),
    info: t("general.detector.cpuUsageInformation"),
  },
  {
    id: "mem",
    title: t("general.detector.memoryUsage"),
    unit: "%",
    threshold: DetectorMemThreshold,
    series: collectSeries(history.value, detectors, (d) => d.mem),
  },
]);

// Intel reports no VRAM, so its memory chart would always be empty
const notIntel = (stats: FrigateStats) =>
  Object.fromEntries(
    Object.entries(stats.gpu_usages ?? {}).filter(
      ([, gpu]) => gpu.vendor !== "intel",
    ),
  ) as Record<string, GpuStats>;

const hardwareCards = computed<Card[]>(() => [
  {
    id: "gpu",
    title: t("general.hardwareInfo.gpuUsage"),
    unit: "%",
    threshold: GpuUsageThreshold,
    series: collectSeries(history.value, gpus, (g) => g.gpu),
  },
  {
    id: "gpu-mem",
    title: t("general.hardwareInfo.gpuMemory"),
    unit: "%",
    threshold: GpuMemThreshold,
    series: collectSeries(history.value, notIntel, (g) => g.mem),
  },
  {
    id: "gpu-enc",
    title: t("general.hardwareInfo.gpuEncoder"),
    unit: "%",
    threshold: GpuUsageThreshold,
    series: collectSeries(history.value, gpus, (g) => g.enc),
  },
  {
    id: "gpu-compute",
    title: t("general.hardwareInfo.gpuCompute"),
    unit: "%",
    threshold: GpuUsageThreshold,
    series: collectSeries(history.value, gpus, (g) => g.compute),
  },
  {
    id: "gpu-dec",
    title: t("general.hardwareInfo.gpuDecoder"),
    unit: "%",
    threshold: GpuUsageThreshold,
    series: collectSeries(history.value, gpus, (g) => g.dec),
  },
  {
    id: "gpu-temp",
    title: t("general.hardwareInfo.gpuTemperature"),
    unit: "°C",
    threshold: DetectorTempThreshold,
    series: collectSeries(history.value, gpus, (g) => g.temp),
  },
  {
    id: "npu",
    title: t("general.hardwareInfo.npuUsage"),
    unit: "%",
    threshold: GpuUsageThreshold,
    series: collectSeries(history.value, npus, (n) => n.npu),
  },
  {
    id: "npu-temp",
    title: t("general.hardwareInfo.npuTemperature"),
    unit: "°C",
    threshold: DetectorTempThreshold,
    series: collectSeries(history.value, npus, (n) => n.temp),
  },
]);

const processName = (key: string) =>
  t(`general.otherProcesses.series.${key}`, { defaultValue: key });

const processCards = computed<Card[]>(() => [
  {
    id: "process-cpu",
    title: t("general.otherProcesses.processCpuUsage"),
    unit: "%",
    threshold: DetectorCpuThreshold,
    series: collectSeries(history.value, processes, (p) => p.cpu, processName),
  },
  {
    id: "process-mem",
    title: t("general.otherProcesses.processMemoryUsage"),
    unit: "%",
    threshold: DetectorMemThreshold,
    series: collectSeries(history.value, processes, (p) => p.mem, processName),
  },
]);

const visible = (cards: Card[]) => cards.filter((card) => card.series.length);

const hasGpu = computed(() =>
  hardwareCards.value.some((c) => c.id.startsWith("gpu") && c.series.length),
);
const hasNpu = computed(() =>
  hardwareCards.value.some((c) => c.id.startsWith("npu") && c.series.length),
);
const hardwareTitle = computed(() =>
  hasGpu.value && !hasNpu.value
    ? "GPUs"
    : !hasGpu.value && hasNpu.value
      ? "NPUs"
      : "GPUs / NPUs",
);

// vainfo covers Intel and AMD, nvidia-smi the rest
const gpuInfoKind = computed<GpuInfoKind | undefined>(() => {
  const vendors = Object.values(history.value[0]?.gpu_usages ?? {}).map(
    (gpu) => gpu.vendor,
  );
  if (vendors.includes("nvidia")) return "nvinfo";
  if (vendors.includes("intel") || vendors.includes("amd")) return "vainfo";
  return undefined;
});
const showGpuInfo = shallowRef(false);
</script>

<template>
  <SystemSection
    :title="t('general.detector.title')"
    :loading="!history.length"
  >
    <MetricCard
      v-for="card in visible(detectorCards)"
      :key="card.id"
      :title="card.title"
    >
      <template v-if="card.info" #actions>
        <InfoTip :label="card.title">{{ card.info }}</InfoTip>
      </template>
      <ThresholdChart
        v-for="line in card.series"
        :key="line.key"
        :name="line.name"
        :values="line.values"
        :times="times"
        :unit="card.unit"
        :threshold="card.threshold"
      />
    </MetricCard>
  </SystemSection>

  <SystemSection v-if="hasGpu || hasNpu" :title="hardwareTitle">
    <template v-if="gpuInfoKind" #actions>
      <AppButton size="sm" @click="showGpuInfo = true">
        {{ t("general.hardwareInfo.title") }}
      </AppButton>
    </template>
    <MetricCard
      v-for="card in visible(hardwareCards)"
      :key="card.id"
      :title="card.title"
    >
      <ThresholdChart
        v-for="line in card.series"
        :key="line.key"
        :name="line.name"
        :values="line.values"
        :times="times"
        :unit="card.unit"
        :threshold="card.threshold"
      />
    </MetricCard>
  </SystemSection>

  <SystemSection
    v-if="visible(processCards).length"
    :title="t('general.otherProcesses.title')"
    min="360px"
  >
    <MetricCard
      v-for="card in visible(processCards)"
      :key="card.id"
      :title="card.title"
    >
      <ThresholdChart
        v-for="line in card.series"
        :key="line.key"
        :name="line.name"
        :values="line.values"
        :times="times"
        :unit="card.unit"
        :threshold="card.threshold"
      />
    </MetricCard>
  </SystemSection>

  <GpuInfoDialog
    v-if="gpuInfoKind"
    v-model:open="showGpuInfo"
    :kind="gpuInfoKind"
  />
</template>
