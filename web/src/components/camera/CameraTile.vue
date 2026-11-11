<script setup lang="ts">
/**
 * Dashboard tile. A refreshing still sits underneath; the live stream fades
 * in on its first frame. In smart mode the stream only runs while there is
 * activity (and briefly after), which keeps big dashboards cheap.
 */
import { computed, onBeforeUnmount, shallowRef, watch } from "vue";
import { Camera, CircleDot, Expand } from "@lucide/vue";
import { baseUrl } from "@/api/baseUrl";
import { cameraLabel } from "@/composables/useFrigate";
import {
  useCameraActivity,
  useFeatureState,
} from "@/composables/useCameraActivity";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";
import OverlayButton from "@/components/ui/OverlayButton.vue";
import CameraStill from "@/components/player/CameraStill.vue";
import LiveVideo from "@/components/player/LiveVideo.vue";
import ActivityTags from "./ActivityTags.vue";
import CameraName from "./CameraName.vue";
import CameraOverlay from "./CameraOverlay.vue";
import CameraTimestamp from "./CameraTimestamp.vue";

const props = withDefaults(
  defineProps<{
    camera: CameraConfig;
    streaming?: "smart" | "continuous";
    transitionName?: string;
  }>(),
  { streaming: "smart", transitionName: undefined },
);
const emit = defineEmits<{ open: [] }>();

const { t } = useT(["views/app"]);
const activity = useCameraActivity(() => props.camera.name);
const recordings = useFeatureState(() => props.camera.name, "recordings");

const SMART_LINGER = 30_000;
const recentlyActive = shallowRef(false);
let lingerTimer: ReturnType<typeof setTimeout> | undefined;

const busy = computed(
  () => activity.activeTracking.value || activity.activeMotion.value,
);
watch(
  busy,
  (now) => {
    clearTimeout(lingerTimer);
    if (now) recentlyActive.value = true;
    else
      lingerTimer = setTimeout(
        () => (recentlyActive.value = false),
        SMART_LINGER,
      );
  },
  { immediate: true },
);
onBeforeUnmount(() => clearTimeout(lingerTimer));

const hovered = shallowRef(false);
const streamWanted = computed(
  () =>
    activity.enabled.value &&
    !activity.offline.value &&
    (props.streaming === "continuous" || recentlyActive.value || hovered.value),
);
const liveShown = shallowRef(false);
watch(streamWanted, (wanted) => {
  if (!wanted) liveShown.value = false;
});

const aspect = computed(() => {
  const { width, height } = props.camera.detect;
  return width && height ? width / height : 16 / 9;
});

const name = computed(() => cameraLabel(props.camera));
const dotState = computed(() =>
  activity.offline.value || !activity.enabled.value
    ? "offline"
    : busy.value
      ? "alert"
      : "live",
);

function snapshot() {
  window.open(
    `${baseUrl}api/${props.camera.name}/latest.jpg`,
    "_blank",
    "noopener",
  );
}
</script>

<template>
  <article
    class="camera-tile"
    :class="{
      'has-alert': activity.activeTracking.value,
      'is-offline': activity.offline.value,
    }"
    :style="{ '--aspect': aspect, viewTransitionName: transitionName }"
    tabindex="0"
    role="button"
    :aria-label="t('dashboard.openCamera', { camera: name })"
    @click="emit('open')"
    @keydown.enter="emit('open')"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <div class="camera-tile__media">
      <CameraStill :camera="camera.name" :active="!liveShown" />
      <div class="camera-tile__live" :class="{ 'is-shown': liveShown }">
        <LiveVideo
          v-if="streamWanted"
          :camera="camera"
          :linger-ms="20_000"
          @frame="liveShown = true"
          @failed="liveShown = false"
        />
      </div>
      <div v-if="activity.offline.value" class="camera-tile__offline">
        {{ t("dashboard.offline") }}
      </div>
    </div>

    <CameraOverlay>
      <template #top-start>
        <CameraName :name="name" :state="dotState" />
      </template>
      <template #top-end>
        <CameraTimestamp />
      </template>
      <template #bottom-start>
        <ActivityTags
          :objects="activity.objects.value"
          :motion="activity.activeMotion.value"
        />
      </template>
      <template #bottom-end>
        <OverlayButton :label="t('dashboard.snapshot')" @click="snapshot"
          ><Camera
        /></OverlayButton>
        <OverlayButton
          :label="
            recordings.on.value
              ? t('dashboard.recordingOn')
              : t('dashboard.recordingOff')
          "
          :active="recordings.on.value"
          tone="danger"
          @click="recordings.set(!recordings.on.value)"
        >
          <CircleDot />
        </OverlayButton>
        <OverlayButton :label="t('dashboard.expand')" @click="emit('open')"
          ><Expand
        /></OverlayButton>
      </template>
    </CameraOverlay>
  </article>
</template>

<style scoped>
.camera-tile {
  container: tile / inline-size;
  position: relative;
  /* set by CameraGrid so every tile fits on screen */
  inline-size: var(--tile-width, 100%);
  max-inline-size: 100%;
  aspect-ratio: var(--aspect);
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition:
    border-color var(--dur),
    box-shadow var(--dur);

  &:hover {
    border-color: var(--line-hover-soft);
    box-shadow: var(--shadow-card-hover);
  }

  &.has-alert {
    border-color: color-mix(in srgb, var(--alert-amber) 50%, transparent);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--alert-amber) 14%, transparent);
  }
}

.camera-tile__media {
  position: absolute;
  inset: 0;
  background: var(--bg-media);
}

.camera-tile__live {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity var(--dur-layer) var(--ease);

  &.is-shown {
    opacity: 1;
  }
}

.camera-tile__offline {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  font-size: var(--text-md);
  background: color-mix(in srgb, var(--bg-media) 65%, transparent);
}

.is-offline :deep(.camera-still) {
  filter: grayscale(1) brightness(0.6);
}
</style>
