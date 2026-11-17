<script setup lang="ts">
/**
 * Thumbnail of a camera in the strip, kept in step with the stage. While the
 * stage is live the camera streams live when it has activity (a refreshing
 * still otherwise); while the stage plays a recording it shows the preview
 * frame for the same moment.
 */
import { computed, shallowRef, watch } from "vue";
import { cameraLabel } from "@/composables/useFrigate";
import { useSmartStream } from "@/composables/useSmartStream";
import type { CameraConfig } from "@/types/frigate";
import CameraStill from "@/components/player/CameraStill.vue";
import LiveVideo from "@/components/player/LiveVideo.vue";
import PreviewScrubber from "@/components/player/PreviewScrubber.vue";
import StatusDot from "@/components/ui/StatusDot.vue";

const props = defineProps<{
  camera: CameraConfig;
  current?: boolean;
  mode: "live" | "recording";
  /** stage time while it plays a recording */
  time: number;
}>();

const live = computed(() => props.mode === "live");
// the stage already holds the current camera's stream, and a pool session
// owns a single media element, so the current item never leases it
const { activity, busy, hovered, streamWanted, liveShown } = useSmartStream(
  () => props.camera.name,
  { enabled: () => live.value && !props.current },
);

const recordingShown = shallowRef(false);
watch(live, (now) => {
  if (now) recordingShown.value = false;
});

const name = computed(() => cameraLabel(props.camera));
const aspect = computed(() => {
  const { width, height } = props.camera.detect;
  return width && height ? width / height : 16 / 9;
});
</script>

<template>
  <button
    type="button"
    class="strip-item"
    :class="{
      'has-alert': live && activity.activeTracking.value,
      'is-current': current,
      'is-unrecorded': !live && !recordingShown,
    }"
    :aria-current="current || undefined"
    :style="{ '--aspect': aspect }"
    :title="name"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <CameraStill
      :camera="camera.name"
      :height="180"
      :active="live && !liveShown"
      :interval="busy ? 2000 : 10_000"
    />
    <div class="strip-item__layer" :class="{ 'is-shown': live && liveShown }">
      <LiveVideo
        v-if="streamWanted"
        :camera="camera"
        :linger-ms="20_000"
        @frame="liveShown = true"
        @failed="liveShown = false"
      />
    </div>
    <div
      class="strip-item__layer"
      :class="{ 'is-shown': !live && recordingShown }"
    >
      <PreviewScrubber
        :camera="camera.name"
        :time="time"
        :active="!live"
        @frame="recordingShown = $event"
      />
    </div>
    <span class="strip-item__label">
      <StatusDot
        :state="
          activity.offline.value ? 'offline' : live && busy ? 'alert' : 'live'
        "
      />
      {{ name }}
    </span>
  </button>
</template>

<style scoped>
.strip-item {
  position: relative;
  flex-shrink: 0;
  block-size: 100%;
  aspect-ratio: var(--aspect);
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-media);
  transition:
    border-color var(--dur),
    translate var(--dur) var(--ease);

  &:hover {
    border-color: var(--line-hover);
    translate: 0 -2px;
  }

  &.has-alert {
    border-color: color-mix(in srgb, var(--alert-amber) 50%, transparent);
  }

  &.is-current {
    border-color: var(--selected-border);
    box-shadow: 0 0 0 1px var(--selected-border);
    cursor: default;

    &:hover {
      translate: none;
    }
  }
}

.strip-item__layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity var(--dur-layer) var(--ease);

  &.is-shown {
    opacity: 1;
  }
}

/* no preview for this moment: the latest still is not what happened then */
.strip-item.is-unrecorded :deep(.camera-still) {
  filter: grayscale(1) brightness(0.4);
}

.strip-item__label {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 8px 6px;
  background: var(--scrim-bottom);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-on-media);
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
