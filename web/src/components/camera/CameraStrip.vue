<script setup lang="ts">
/**
 * Row of every camera under the stage, in config order. The camera on the stage
 * stays in place and is marked current, so switching never reshuffles the row.
 * Every thumbnail follows the stage: live while it is live, the same recorded
 * moment while it plays or scrubs a recording.
 */
import type { CameraConfig } from "@/types/frigate";
import CameraStripItem from "./CameraStripItem.vue";

defineProps<{
  cameras: CameraConfig[];
  current: string;
  mode: "live" | "recording";
  time: number;
}>();
const emit = defineEmits<{ select: [camera: string] }>();
</script>

<template>
  <div v-if="cameras.length > 1" class="camera-strip">
    <CameraStripItem
      v-for="camera in cameras"
      :key="camera.name"
      :camera="camera"
      :current="camera.name === current"
      :mode="mode"
      :time="time"
      @click="camera.name !== current && emit('select', camera.name)"
    />
  </div>
</template>

<style scoped>
.camera-strip {
  display: flex;
  gap: 8px;
  padding: 2px;
  overflow-x: auto;
  flex-shrink: 0;
  justify-content: safe center;
  block-size: 112px;
}
</style>
