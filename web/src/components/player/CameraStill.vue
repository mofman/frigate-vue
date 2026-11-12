<script setup lang="ts">
/**
 * Auto refreshing snapshot. Loads the next image off screen and swaps it in
 * once decoded, so refreshes never flash.
 */
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { baseUrl } from "@/api/baseUrl";
import { demoImage, demoMode } from "@/utils/demo";

const props = withDefaults(
  defineProps<{
    camera: string;
    height?: number;
    interval?: number;
    active?: boolean;
  }>(),
  { height: 360, interval: 10_000, active: true },
);

const src = shallowRef<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

function next() {
  clearTimeout(timer);
  if (demoMode) {
    src.value = demoImage(props.camera);
    return;
  }
  const url = `${baseUrl}api/${props.camera}/latest.webp?height=${props.height}&cache=${Date.now()}`;
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  image
    .decode()
    .then(() => (src.value = url))
    .catch(() => undefined)
    .finally(() => {
      if (props.active) timer = setTimeout(next, props.interval);
    });
}

watch(
  () => [props.camera, props.active] as const,
  ([, active]) => {
    clearTimeout(timer);
    if (active) next();
  },
  { immediate: true },
);

onBeforeUnmount(() => clearTimeout(timer));

const image = shallowRef<HTMLImageElement | null>(null);
defineExpose({ image });
</script>

<template>
  <img
    v-if="src"
    ref="image"
    class="camera-still"
    :class="{ 'is-demo': demoMode }"
    :src="src"
    alt=""
    decoding="async"
  />
</template>

<style scoped>
.camera-still {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;

  &.is-demo {
    object-fit: cover;
  }
}
</style>
