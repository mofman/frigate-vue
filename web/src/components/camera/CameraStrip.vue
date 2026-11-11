<script setup lang="ts">
/** Row of other cameras under the stage. Clicking one switches the stage. */
import { computed } from "vue";
import type { CameraConfig } from "@/types/frigate";
import CameraStripItem from "./CameraStripItem.vue";

const props = defineProps<{ cameras: CameraConfig[]; current: string }>();
const emit = defineEmits<{ select: [camera: string] }>();
const others = computed(() =>
  props.cameras.filter((camera) => camera.name !== props.current),
);
</script>

<template>
  <div v-if="others.length" class="camera-strip">
    <CameraStripItem
      v-for="camera in others"
      :key="camera.name"
      :camera="camera"
      @click="emit('select', camera.name)"
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
