<script setup lang="ts">
/**
 * System > Cameras: overall frame and detection rates, then per camera CPU
 * and fps with the connection quality the backend measures.
 */
import { computed, shallowRef } from "vue";
import { Info, VideoOff } from "@lucide/vue";
import { cameraLabel, useCameras } from "@/composables/useFrigate";
import { useStatsHistory } from "@/composables/useStatsHistory";
import { useT } from "@/composables/useT";
import type { CameraStats, FrigateStats } from "@/types/stats";
import { valueSeries } from "@/utils/stats";
import LineChart from "@/components/charts/LineChart.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import IconButton from "@/components/ui/IconButton.vue";
import MetricCard from "./MetricCard.vue";
import SystemSection from "./SystemSection.vue";
import ConnectionQuality from "./ConnectionQuality.vue";
import CameraProbeDialog from "./CameraProbeDialog.vue";

const props = defineProps<{ active: boolean }>();
const { t } = useT(["views/system"]);
const cameras = useCameras();

const { history, times } = useStatsHistory(
  "cameras.camera_fps,cameras.detection_fps,cameras.skipped_fps,cameras.ffmpeg_cpu,cameras.capture_cpu,cameras.detect_cpu,cameras.connection_quality,cameras.expected_fps,cameras.reconnects_last_hour,cameras.stalls_last_hour,camera_fps,detection_fps,skipped_fps,service.last_updated",
  () => props.active,
);

const shortLabels = computed(() => [
  t("cameras.label.camera"),
  t("cameras.label.detect"),
  t("cameras.label.skipped"),
]);

const overall = computed(() => [
  valueSeries(
    history.value,
    "fps",
    t("cameras.label.overallFramesPerSecond"),
    (s) => s.camera_fps,
  ),
  valueSeries(
    history.value,
    "dps",
    t("cameras.label.overallDetectionsPerSecond"),
    (s) => s.detection_fps,
  ),
  valueSeries(
    history.value,
    "skipped",
    t("cameras.label.overallSkippedDetectionsPerSecond"),
    (s) => s.skipped_fps,
  ),
]);

const cam = (stats: FrigateStats, name: string): CameraStats | undefined =>
  stats.cameras?.[name];

const perCamera = computed(() =>
  cameras.value
    .filter((camera) => camera.enabled)
    .map((camera) => {
      const name = camera.name;
      const camName = cameraLabel(camera);
      const latest = history.value.at(-1)?.cameras?.[name];
      return {
        name,
        label: camName,
        latest,
        cpu: [
          valueSeries(
            history.value,
            "ffmpeg",
            t("cameras.label.cameraFfmpeg", { camName }),
            (s) => cam(s, name)?.ffmpeg_cpu ?? 0,
          ),
          valueSeries(
            history.value,
            "capture",
            t("cameras.label.cameraCapture", { camName }),
            (s) => cam(s, name)?.capture_cpu ?? 0,
          ),
          valueSeries(
            history.value,
            "detect",
            t("cameras.label.cameraDetect", { camName }),
            (s) => cam(s, name)?.detect_cpu ?? 0,
          ),
        ],
        fps: [
          valueSeries(
            history.value,
            "fps",
            t("cameras.label.cameraFramesPerSecond", { camName }),
            (s) => cam(s, name)?.camera_fps,
          ),
          valueSeries(
            history.value,
            "dps",
            t("cameras.label.cameraDetectionsPerSecond", { camName }),
            (s) => cam(s, name)?.detection_fps,
          ),
          valueSeries(
            history.value,
            "skipped",
            t("cameras.label.cameraSkippedDetectionsPerSecond", { camName }),
            (s) => cam(s, name)?.skipped_fps,
          ),
        ],
      };
    }),
);

const cpuLabels = computed(() => [
  t("cameras.label.ffmpeg"),
  t("cameras.label.capture"),
  t("cameras.label.detect"),
]);

const probeCamera = shallowRef("");
const probeOpen = shallowRef(false);
function probe(name: string) {
  probeCamera.value = name;
  probeOpen.value = true;
}
</script>

<template>
  <EmptyState v-if="!cameras.length" :title="t('cameras.noCameras.title')">
    <template #icon><VideoOff /></template>
  </EmptyState>
  <template v-else>
    <SystemSection
      :title="t('cameras.overview')"
      min="360px"
      :loading="!history.length"
    >
      <MetricCard :title="t('cameras.framesAndDetections')">
        <LineChart :series="overall" :times="times" :labels="shortLabels" />
      </MetricCard>
    </SystemSection>

    <div class="camera-metrics">
      <SystemSection
        v-for="camera in history.length ? perCamera : []"
        :key="camera.name"
        :title="camera.label"
        min="320px"
      >
        <template #actions>
          <ConnectionQuality v-if="camera.latest" :stats="camera.latest" />
          <IconButton
            size="sm"
            :label="t('cameras.info.tips.title')"
            @click="probe(camera.name)"
            ><Info
          /></IconButton>
        </template>
        <MetricCard title="CPU">
          <LineChart
            :series="camera.cpu"
            :times="times"
            :labels="cpuLabels"
            unit="%"
          />
        </MetricCard>
        <MetricCard :title="t('cameras.framesAndDetections')">
          <LineChart
            :series="camera.fps"
            :times="times"
            :labels="shortLabels"
          />
        </MetricCard>
      </SystemSection>
    </div>

    <CameraProbeDialog
      v-if="probeCamera"
      v-model:open="probeOpen"
      :camera="probeCamera"
    />
  </template>
</template>

<style scoped>
/* two cameras side by side on wide screens, each with its two charts */
.camera-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(680px, 100%), 1fr));
  gap: 24px;
}
</style>
