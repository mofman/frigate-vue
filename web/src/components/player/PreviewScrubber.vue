<script setup lang="ts">
/**
 * Fast scrub layer. While the timeline is dragged this shows Frigate's low
 * resolution preview clips (past hours) or preview frames (current hour), so
 * dragging is instant and the full resolution player only seeks once on
 * release.
 */
import { computed, shallowRef, watch } from "vue";
import { baseUrl, mediaUrl } from "@/api/baseUrl";
import { useQuery } from "@/api/query";
import type { Preview } from "@/types/frigate";

const props = defineProps<{ camera: string; time: number; active: boolean }>();
const emit = defineEmits<{ frame: [hasFrame: boolean] }>();

const HOUR = 3600;
// key windows are aligned so the cache key only changes once an hour
const rangeKey = computed(() => {
  const now = Date.now() / 1000;
  const end = Math.ceil(now / HOUR) * HOUR + HOUR;
  return [
    `preview/${props.camera}/start/${end - 26 * HOUR}/end/${end}`,
  ] as const;
});
const { data: previews } = useQuery<Preview[]>(
  () => (props.active ? rangeKey.value : null),
  {
    refreshInterval: 5 * 60_000,
    staleTime: 60_000,
  },
);

const hourStart = computed(() => Math.floor(props.time / HOUR) * HOUR);
const clip = computed(() =>
  previews.value?.find(
    (preview) => props.time >= preview.start && props.time <= preview.end,
  ),
);

const framesKey = computed(() =>
  props.active && !clip.value
    ? ([
        `preview/${props.camera}/start/${hourStart.value}/end/${hourStart.value + HOUR}/frames`,
      ] as const)
    : null,
);
const { data: frames, refresh: refreshFrames } = useQuery<string[]>(framesKey, {
  staleTime: 15_000,
});

const frameTimes = computed(() =>
  (frames.value ?? []).map((name) => ({
    name,
    time: parseFloat(
      name
        .split("-")
        .at(-1)
        ?.replace(/\.webp$/, "") ?? "0",
    ),
  })),
);

// refresh the newest frames each time a scrub starts
watch(
  () => props.active,
  (active) => {
    if (active) void refreshFrames();
  },
);

const video = shallowRef<HTMLVideoElement | null>(null);
const image = shallowRef<HTMLImageElement | null>(null);
const imageSrc = shallowRef<string>();
const showing = shallowRef<"clip" | "frame" | null>(null);
let seeking = false;
let pendingSeek: number | undefined;
let imageToken = 0;

function seekClip(position: number) {
  const el = video.value;
  if (!el) return;
  if (seeking) {
    pendingSeek = position;
    return;
  }
  seeking = true;
  el.currentTime = position;
}

function onSeeked() {
  seeking = false;
  showing.value = "clip";
  emit("frame", true);
  if (pendingSeek !== undefined) {
    const next = pendingSeek;
    pendingSeek = undefined;
    seekClip(next);
  }
}

function showFrame(time: number) {
  const frame =
    frameTimes.value.find((entry) => entry.time >= time) ??
    frameTimes.value.at(-1);
  if (!frame) {
    if (showing.value !== "clip") emit("frame", false);
    return;
  }
  const url = `${baseUrl}api/preview/${frame.name}/thumbnail.webp`;
  if (url === imageSrc.value) return;
  const token = ++imageToken;
  const image = new Image();
  image.src = url;
  image
    .decode()
    .then(() => {
      if (token !== imageToken) return;
      imageSrc.value = url;
      showing.value = "frame";
      emit("frame", true);
    })
    .catch(() => undefined);
}

watch(
  () => [props.time, props.active, clip.value, frameTimes.value] as const,
  ([time, active, current]) => {
    if (!active) return;
    if (current) {
      const el = video.value;
      const src = mediaUrl(current.src);
      if (el && el.dataset.src !== src) {
        el.dataset.src = src;
        el.src = src;
        seeking = false;
      }
      seekClip(Math.max(0, time - current.start));
    } else {
      showFrame(time);
    }
  },
);

defineExpose({
  /** Element to capture into the frame hold when releasing a scrub. */
  frameSource: () =>
    (showing.value === "clip" ? video.value : image.value) ?? undefined,
});
</script>

<template>
  <div class="preview-scrubber">
    <video
      v-show="showing === 'clip'"
      ref="video"
      class="preview-scrubber__media"
      muted
      playsinline
      preload="auto"
      @seeked="onSeeked"
    />
    <img
      v-if="imageSrc"
      v-show="showing === 'frame'"
      ref="image"
      class="preview-scrubber__media"
      :src="imageSrc"
      alt=""
    />
  </div>
</template>

<style scoped>
.preview-scrubber {
  position: absolute;
  inset: 0;
  background: var(--bg-media);
}

.preview-scrubber__media {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}
</style>
