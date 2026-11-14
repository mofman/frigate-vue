<script setup lang="ts">
/**
 * Camera tiles packed into justified rows sized so they all fit on screen at
 * once. Each tile reads its rect through `gridRectsKey`; in list mode and on
 * phones the tiles fall back to a plain scrolling column.
 */
import { computed, provide, shallowRef } from "vue";
import { useElementSize, useMediaQuery } from "@/composables/useUtil";
import { fitAllLayout, gridSpacing, type TileRect } from "@/utils/gridLayout";
import type { CameraConfig } from "@/types/frigate";
import { gridRectsKey } from "./gridContext";

const props = defineProps<{ cameras: CameraConfig[]; single?: boolean }>();

const root = shallowRef<HTMLElement | null>(null);
const { width, height } = useElementSize(root);
const phone = useMediaQuery("(max-width: 768px)");
const scrolling = computed(() => props.single || phone.value);

const rects = computed(() => {
  const map = new Map<string, TileRect>();
  if (scrolling.value) return map;
  const { rects } = fitAllLayout(
    props.cameras.map((camera) => ({
      aspect:
        camera.detect.width && camera.detect.height
          ? camera.detect.width / camera.detect.height
          : 16 / 9,
    })),
    width.value,
    height.value,
  );
  rects.forEach((rect, i) => map.set(props.cameras[i].name, rect));
  return map;
});
provide(gridRectsKey, rects);

const spacing = computed(() => gridSpacing(width.value));
</script>

<template>
  <div
    ref="root"
    class="camera-grid"
    :class="{ 'is-scrolling': scrolling }"
    :style="{
      '--gap': `${spacing.gap}px`,
      '--pad': `${spacing.padding}px`,
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.camera-grid {
  position: relative;
  min-block-size: 0;
  overflow: hidden;

  &.is-scrolling {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    /* rows must not shrink below each tile's aspect ratio height */
    grid-auto-rows: max-content;
    gap: var(--gap);
    padding: var(--pad);
    overflow-y: auto;
  }
}

@media (max-width: 768px) {
  .camera-grid.is-scrolling {
    overflow: visible;
  }
}
</style>
