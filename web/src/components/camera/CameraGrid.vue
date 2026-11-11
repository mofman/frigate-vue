<script setup lang="ts">
/** Grid of camera tiles sized so they all fit on screen at once. */
import { computed, shallowRef } from "vue";
import { useElementSize, useMediaQuery } from "@/composables/useUtil";
import { fitAllLayout, gridSpacing } from "@/utils/gridLayout";
import type { CameraConfig } from "@/types/frigate";

const props = defineProps<{ cameras: CameraConfig[]; single?: boolean }>();

const root = shallowRef<HTMLElement | null>(null);
const { width, height } = useElementSize(root);
const phone = useMediaQuery("(max-width: 768px)");

const layout = computed(() => {
  if (props.single || phone.value) return { columns: 1, tileWidth: 0 };
  return fitAllLayout(
    props.cameras.map((camera) => ({
      aspect:
        camera.detect.width && camera.detect.height
          ? camera.detect.width / camera.detect.height
          : 16 / 9,
    })),
    width.value,
    height.value,
  );
});
const spacing = computed(() => gridSpacing(width.value));
</script>

<template>
  <div
    ref="root"
    class="camera-grid"
    :class="{ 'is-scrolling': single || phone }"
    :style="{
      '--columns': layout.columns,
      '--tile-width':
        layout.tileWidth && !(single || phone)
          ? `${layout.tileWidth}px`
          : '100%',
      '--gap': `${spacing.gap}px`,
      '--pad': `${spacing.padding}px`,
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.camera-grid {
  display: grid;
  grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
  align-content: center;
  justify-items: center;
  gap: var(--gap);
  padding: var(--pad);
  min-block-size: 0;
  overflow: hidden;

  &.is-scrolling {
    align-content: start;
    /* rows must not shrink below each tile's aspect ratio height */
    grid-auto-rows: max-content;
    overflow-y: auto;
  }
}

@media (max-width: 768px) {
  .camera-grid.is-scrolling {
    overflow: visible;
  }
}
</style>
