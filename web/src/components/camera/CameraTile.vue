<script setup lang="ts">
/**
 * Dashboard tile. A refreshing still sits underneath; the live stream fades
 * in on its first frame. In smart mode the stream only runs while there is
 * activity (and briefly after), which keeps big dashboards cheap.
 */
import { computed, inject, onBeforeUnmount, shallowRef, watch } from "vue";
import { Camera, CircleDot, CircleStop, Expand } from "@lucide/vue";
import { cameraLabel } from "@/composables/useFrigate";
import { useCameraActivity } from "@/composables/useCameraActivity";
import { useManualRecording } from "@/composables/useManualRecording";
import { saveSnapshot } from "@/utils/snapshot";
import { useStreamAudio } from "@/composables/useStreamAudio";
import { cameraStreams } from "@/players/streams";
import StreamStats from "@/components/player/StreamStats.vue";
import TileMenu from "./TileMenu.vue";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";
import OverlayButton from "@/components/ui/OverlayButton.vue";
import CameraStill from "@/components/player/CameraStill.vue";
import LiveVideo from "@/components/player/LiveVideo.vue";
import ActivityTags from "./ActivityTags.vue";
import CameraName from "./CameraName.vue";
import CameraOverlay from "./CameraOverlay.vue";
import CameraTimestamp from "./CameraTimestamp.vue";
import { demoMode } from "@/utils/demo";
import { gridRectsKey } from "./gridContext";

const props = withDefaults(
  defineProps<{
    camera: CameraConfig;
    streaming?: "smart" | "continuous";
    transitionName?: string;
    /** tile audio, off unless turned on from the tile menu */
    muted?: boolean;
    showStats?: boolean;
  }>(),
  {
    streaming: "smart",
    transitionName: undefined,
    muted: true,
    showStats: false,
  },
);
const emit = defineEmits<{
  open: [];
  "update:muted": [value: boolean];
  "update:showStats": [value: boolean];
  muteAll: [muted: boolean];
}>();

const { t } = useT(["views/app"]);
const activity = useCameraActivity(() => props.camera.name);
const manual = useManualRecording(() => props.camera.name);
const audio = useStreamAudio(
  () => cameraStreams(props.camera)[0]?.[1] ?? undefined,
);
const menu = shallowRef<InstanceType<typeof TileMenu> | null>(null);

function onContextMenu(event: MouseEvent) {
  event.preventDefault();
  menu.value?.openAt(event.clientX, event.clientY);
}
const recordingNow = computed(() => !!manual.eventId.value);
const liveRef = shallowRef<InstanceType<typeof LiveVideo> | null>(null);

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
    !demoMode &&
    activity.enabled.value &&
    !activity.offline.value &&
    (props.streaming === "continuous" ||
      recentlyActive.value ||
      hovered.value ||
      !props.muted ||
      props.showStats),
);
const liveShown = shallowRef(false);
watch(streamWanted, (wanted) => {
  if (!wanted) liveShown.value = false;
});

const aspect = computed(() => {
  const { width, height } = props.camera.detect;
  return width && height ? width / height : 16 / 9;
});

const gridRects = inject(gridRectsKey, undefined);
const gridRect = computed(() => gridRects?.value.get(props.camera.name));
const placement = computed(() => {
  const rect = gridRect.value;
  if (!rect) return {};
  return {
    insetInlineStart: `${rect.x}px`,
    insetBlockStart: `${rect.y}px`,
    inlineSize: `${rect.width}px`,
    blockSize: `${rect.height}px`,
  };
});

const name = computed(() => cameraLabel(props.camera));
const dotState = computed(() =>
  activity.offline.value || !activity.enabled.value
    ? "offline"
    : busy.value
      ? "alert"
      : "live",
);

const snapshotBusy = shallowRef(false);
async function snapshot() {
  if (snapshotBusy.value) return;
  snapshotBusy.value = true;
  try {
    await saveSnapshot(props.camera.name, {
      source: liveShown.value ? liveRef.value?.frameSource() : undefined,
    });
  } finally {
    snapshotBusy.value = false;
  }
}
</script>

<template>
  <article
    class="camera-tile"
    :class="{
      // motion alone lights the border too, as in the previous UI
      'has-alert': busy,
      'is-offline': activity.offline.value,
      'is-placed': !!gridRect,
    }"
    :style="{
      '--aspect': aspect,
      viewTransitionName: transitionName,
      ...placement,
    }"
    tabindex="0"
    role="button"
    :aria-label="t('dashboard.openCamera', { camera: name })"
    @click="emit('open')"
    @keydown.enter="emit('open')"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
    @contextmenu="onContextMenu"
  >
    <div class="camera-tile__media">
      <CameraStill :camera="camera.name" :active="!liveShown" />
      <div class="camera-tile__live" :class="{ 'is-shown': liveShown }">
        <LiveVideo
          v-if="streamWanted"
          ref="liveRef"
          :camera="camera"
          :muted="muted"
          :linger-ms="20_000"
          @frame="liveShown = true"
          @failed="liveShown = false"
        />
      </div>
      <StreamStats
        v-if="showStats && liveShown"
        layer="live"
        :live-mode="liveRef?.mode"
        :live-session="liveRef?.session"
      />
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
        <OverlayButton
          :label="t('dashboard.snapshot')"
          :disabled="snapshotBusy"
          @click="snapshot"
          ><Camera
        /></OverlayButton>
        <OverlayButton
          :label="recordingNow ? t('player.recordStop') : t('player.recordNow')"
          :active="recordingNow"
          tone="danger"
          @click="manual.toggle()"
        >
          <CircleStop v-if="recordingNow" />
          <CircleDot v-else />
        </OverlayButton>
        <OverlayButton :label="t('dashboard.expand')" @click="emit('open')"
          ><Expand
        /></OverlayButton>
        <TileMenu
          ref="menu"
          :camera="camera"
          :has-audio="audio.audioOutput.value"
          :muted="muted"
          :stats="showStats"
          @update:muted="emit('update:muted', $event)"
          @update:stats="emit('update:showStats', $event)"
          @mute-all="emit('muteAll', $event)"
          @open="emit('open')"
        />
      </template>
    </CameraOverlay>
  </article>
</template>

<style scoped>
.camera-tile {
  container: tile / inline-size;
  position: relative;
  /* keep the overlay z-indexes inside, below the pinned page header */
  isolation: isolate;
  inline-size: 100%;
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

  /* CameraGrid's fit-all layout positions and sizes the tile */
  &.is-placed {
    position: absolute;
    max-inline-size: none;
    aspect-ratio: auto;
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
