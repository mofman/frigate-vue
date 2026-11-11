<script setup lang="ts">
/** Camera dashboard: every camera at once with recent activity alongside. */
import { computed, nextTick, onMounted, shallowRef } from "vue";
import { useRouter } from "vue-router";
import { LayoutGrid, Maximize2, Minimize2, Rows3 } from "@lucide/vue";
import PageHeader from "@/components/layout/PageHeader.vue";
import CameraGrid from "@/components/camera/CameraGrid.vue";
import CameraTile from "@/components/camera/CameraTile.vue";
import ActivityPanel from "@/components/review/ActivityPanel.vue";
import CountPill from "@/components/ui/CountPill.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import IconButton from "@/components/ui/IconButton.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";
import {
  useCameras,
  useStats,
  isCameraOffline,
} from "@/composables/useFrigate";
import { useFullscreen, usePersistedRef } from "@/composables/useUtil";
import { useT } from "@/composables/useT";

const { t } = useT(["views/app"]);
const router = useRouter();
const cameras = useCameras();
const stats = useStats();

const layout = usePersistedRef<"grid" | "list">("dashboard-layout", "grid");
const streaming = usePersistedRef<"smart" | "continuous">(
  "dashboard-streaming",
  "smart",
);

const liveCount = computed(
  () =>
    cameras.value.filter(
      (camera) => camera.enabled && !isCameraOffline(stats.value, camera.name),
    ).length,
);
const dashboardCameras = computed(() =>
  cameras.value.filter((camera) => camera.ui.dashboard !== false),
);

const root = shallowRef<HTMLElement | null>(null);
const { isFullscreen, supported, toggle } = useFullscreen(root);

const expanding = shallowRef<string>();

// fetch the camera view (and hls.js) while idle so opening a tile never waits
onMounted(() => {
  const load = () => void import("@/views/CameraView.vue");
  if ("requestIdleCallback" in window)
    requestIdleCallback(load, { timeout: 3000 });
  else setTimeout(load, 1500);
});

/** Expand the tile into the camera view with a shared element transition. */
async function open(name: string) {
  const go = () => router.push({ name: "camera", params: { name } });
  if (!("startViewTransition" in document)) {
    await go();
    return;
  }
  expanding.value = name;
  await nextTick();
  const transition = document.startViewTransition(async () => {
    await go();
    await nextTick();
  });
  void transition.finished.finally(() => (expanding.value = undefined));
}
</script>

<template>
  <div ref="root" class="dashboard">
    <PageHeader :title="t('dashboard.title')">
      <template #meta>
        <CountPill>{{
          t("dashboard.liveCount", { count: liveCount })
        }}</CountPill>
      </template>
      <template #actions>
        <SegmentedToggle
          v-model="streaming"
          :label="t('dashboard.streaming')"
          :options="[
            {
              value: 'smart',
              label: t('dashboard.smartStreaming'),
              text: true,
            },
            {
              value: 'continuous',
              label: t('dashboard.continuousStreaming'),
              text: true,
            },
          ]"
          class="dashboard__streaming"
        />
        <SegmentedToggle
          v-model="layout"
          :label="t('dashboard.layout')"
          :options="[
            { value: 'grid', label: t('dashboard.fitAll'), icon: LayoutGrid },
            { value: 'list', label: t('dashboard.list'), icon: Rows3 },
          ]"
        />
        <IconButton
          v-if="supported"
          :label="
            isFullscreen ? t('player.exitFullscreen') : t('player.fullscreen')
          "
          @click="toggle"
        >
          <Minimize2 v-if="isFullscreen" />
          <Maximize2 v-else />
        </IconButton>
      </template>
    </PageHeader>

    <div class="dashboard__content">
      <CameraGrid
        v-if="dashboardCameras.length"
        :cameras="dashboardCameras"
        :single="layout === 'list'"
      >
        <CameraTile
          v-for="camera in dashboardCameras"
          :key="camera.name"
          :camera="camera"
          :streaming="streaming"
          :transition-name="
            expanding === camera.name ? 'camera-stage' : undefined
          "
          @open="open(camera.name)"
        />
      </CameraGrid>
      <EmptyState v-else :title="t('dashboard.noCameras')" />
      <ActivityPanel :cameras="dashboardCameras.map((camera) => camera.name)" />
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
  background: var(--backdrop-page), var(--bg-deep);
}

.dashboard__content {
  flex: 1;
  min-block-size: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--panel-width);
}

@media (max-width: 1200px) {
  .dashboard__streaming {
    display: none;
  }
}

@media (max-width: 1024px) {
  .dashboard__content {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }
}
</style>
