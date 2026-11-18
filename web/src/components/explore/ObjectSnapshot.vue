<script setup lang="ts">
/** A tracked object's snapshot, or its thumbnail, with pan and zoom. */
import { computed, shallowRef, watch } from "vue";
import SkeletonBlock from "@/components/ui/SkeletonBlock.vue";
import { useZoomPan } from "@/composables/useZoomPan";
import type { TrackedEvent } from "@/types/event";
import { eventSnapshot, eventThumbnail } from "@/utils/explore";

const props = defineProps<{ event: TrackedEvent }>();

const frame = shallowRef<HTMLElement | null>(null);
const loaded = shallowRef(false);
const { style, reset } = useZoomPan(frame);

const src = computed(() =>
  props.event.has_snapshot
    ? eventSnapshot(props.event)
    : eventThumbnail(props.event),
);

watch(src, () => {
  loaded.value = false;
  reset();
});
</script>

<template>
  <div ref="frame" class="object-snapshot">
    <SkeletonBlock v-if="!loaded" class="object-snapshot__loading" />
    <img
      :key="src"
      class="object-snapshot__image"
      :class="{ 'is-loaded': loaded }"
      :style="style"
      :src="src"
      :alt="event.label"
      draggable="false"
      @load="loaded = true"
      @error="loaded = true"
    />
  </div>
</template>

<style scoped>
.object-snapshot {
  position: relative;
  display: grid;
  place-items: center;
  block-size: min(72dvh, 680px);
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--bg-media);
  touch-action: none;
}

.object-snapshot__loading {
  position: absolute;
  inset: 0;
}

/* fills the frame so zooming lines up with the pointer */
.object-snapshot__image {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
  opacity: 0;
  transform-origin: 0 0;
  user-select: none;

  &.is-loaded {
    opacity: 1;
  }
}

@media (max-width: 900px) {
  .object-snapshot {
    block-size: 46dvh;
  }
}
</style>
