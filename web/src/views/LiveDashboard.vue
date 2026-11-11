<script setup lang="ts">
/** Camera dashboard: every camera at once with recent activity alongside. */
import { computed, nextTick, onMounted, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import CameraGroupPicker from "@/components/camera/CameraGroupPicker.vue";
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
  useConfig,
  useStats,
  isCameraOffline,
} from "@/composables/useFrigate";
import { useFullscreen, usePersistedRef } from "@/composables/useUtil";
import { useT } from "@/composables/useT";

const { t } = useT(["views/app"]);
const router = useRouter();
const route = useRoute();
const cameras = useCameras();
const stats = useStats();
const { data: config } = useConfig();

// ---- camera group: remembered, and shareable through ?group= ---------------

const savedGroup = usePersistedRef("camera-group", "default");
if (typeof route.query.group === "string" && route.query.group)
  savedGroup.value = route.query.group;
const group = computed({
  get: () =>
    savedGroup.value !== "default" &&
    config.value &&
    !config.value.camera_groups?.[savedGroup.value]
      ? "default"
      : savedGroup.value,
  set: (value: string) => (savedGroup.value = value),
});
watch(
  group,
  (value) => {
    const current = route.query.group;
    if ((value === "default" && !current) || current === value) return;
    const { group: _drop, ...rest } = route.query;
    void router.replace({
      query: value === "default" ? rest : { ...rest, group: value },
    });
  },
  { immediate: true },
);

// ---- per tile audio and stats ------------------------------------------------

const tileAudio = usePersistedRef<Record<string, boolean>>("tile-audio", {});
const tileStats = shallowRef<Record<string, boolean>>({});

function setTileAudio(camera: string, unmuted: boolean) {
  tileAudio.value = { ...tileAudio.value, [camera]: unmuted };
}

function setAllAudio(muted: boolean) {
  tileAudio.value = Object.fromEntries(
    dashboardCameras.value.map((camera) => [camera.name, !muted]),
  );
}

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
const dashboardCameras = computed(() => {
  const members =
    group.value === "default"
      ? undefined
      : config.value?.camera_groups?.[group.value]?.cameras;
  return cameras.value.filter((camera) =>
    members ? members.includes(camera.name) : camera.ui.dashboard !== false,
  );
});

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
        <CameraGroupPicker v-model="group" />
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
          :muted="!tileAudio[camera.name]"
          :show-stats="!!tileStats[camera.name]"
          @update:muted="setTileAudio(camera.name, !$event)"
          @update:show-stats="
            tileStats = { ...tileStats, [camera.name]: $event }
          "
          @mute-all="setAllAudio"
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

/* phones scroll the whole document, the grid just grows */
@media (max-width: 768px) {
  .dashboard {
    block-size: auto;
    min-block-size: 100%;
  }

  .dashboard__content {
    grid-template-rows: auto auto;
  }
}
</style>
