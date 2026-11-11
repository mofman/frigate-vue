<script setup lang="ts">
/** Thumbnail of another camera, showing a refreshing still and activity. */
import { computed } from "vue";
import { cameraLabel } from "@/composables/useFrigate";
import { useCameraActivity } from "@/composables/useCameraActivity";
import type { CameraConfig } from "@/types/frigate";
import CameraStill from "@/components/player/CameraStill.vue";
import StatusDot from "@/components/ui/StatusDot.vue";

const props = defineProps<{ camera: CameraConfig }>();
const activity = useCameraActivity(() => props.camera.name);
const name = computed(() => cameraLabel(props.camera));
const aspect = computed(() => {
  const { width, height } = props.camera.detect;
  return width && height ? width / height : 16 / 9;
});
const busy = computed(
  () => activity.activeTracking.value || activity.activeMotion.value,
);
</script>

<template>
  <button
    type="button"
    class="strip-item"
    :class="{ 'has-alert': activity.activeTracking.value }"
    :style="{ '--aspect': aspect }"
    :title="name"
  >
    <CameraStill
      :camera="camera.name"
      :height="180"
      :interval="busy ? 2000 : 10_000"
    />
    <span class="strip-item__label">
      <StatusDot
        :state="activity.offline.value ? 'offline' : busy ? 'alert' : 'live'"
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
