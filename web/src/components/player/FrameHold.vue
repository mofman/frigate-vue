<script setup lang="ts">
/**
 * Still frame shown on top of the stage while the next layer warms up.
 *
 * capture() copies whatever is on screen into a canvas so a camera or mode
 * switch shows a frozen frame instead of black. When nothing is on screen yet
 * the camera's latest snapshot is used instead.
 */
import { shallowRef } from "vue";

defineProps<{ poster?: string }>();

const canvas = shallowRef<HTMLCanvasElement | null>(null);
const visible = shallowRef(false);
const hasFrame = shallowRef(false);

type Source = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;

function dimensions(source: Source): [number, number] {
  if (source instanceof HTMLVideoElement)
    return [source.videoWidth, source.videoHeight];
  if (source instanceof HTMLImageElement)
    return [source.naturalWidth, source.naturalHeight];
  return [source.width, source.height];
}

/** Freeze the given element's current frame. Returns false if it had none. */
function capture(source: Source | undefined): boolean {
  const target = canvas.value;
  if (!target || !source) {
    hasFrame.value = false;
    visible.value = true;
    return false;
  }
  const [width, height] = dimensions(source);
  if (!width || !height) {
    hasFrame.value = false;
    visible.value = true;
    return false;
  }
  target.width = width;
  target.height = height;
  try {
    target.getContext("2d")?.drawImage(source, 0, 0, width, height);
    hasFrame.value = true;
  } catch {
    // tainted or detached source
    hasFrame.value = false;
  }
  visible.value = true;
  return hasFrame.value;
}

function release() {
  visible.value = false;
}

defineExpose({ capture, release, visible });
</script>

<template>
  <div class="frame-hold" :class="{ 'is-visible': visible }" aria-hidden="true">
    <img
      v-if="poster"
      v-show="!hasFrame"
      class="frame-hold__media"
      :src="poster"
      alt=""
    />
    <canvas v-show="hasFrame" ref="canvas" class="frame-hold__media" />
  </div>
</template>

<style scoped>
.frame-hold {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: var(--bg-media);
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--dur-layer) var(--ease),
    visibility 0s var(--dur-layer);

  &.is-visible {
    opacity: 1;
    visibility: visible;
    /* appear instantly, fade only on the way out */
    transition: none;
  }
}

.frame-hold__media {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}
</style>
