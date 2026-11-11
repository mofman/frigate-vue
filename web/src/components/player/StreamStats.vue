<script setup lang="ts">
/** Diagnostics overlay: transport, resolution, frame rate, drops and lag. */
import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";
import type { LiveMode, LiveSession } from "@/players/session";
import { useT } from "@/composables/useT";

const props = defineProps<{
  layer: "live" | "recording" | "preview";
  liveMode?: LiveMode;
  liveSession?: LiveSession;
  recording?: HTMLVideoElement | null;
}>();

const { t } = useT(["views/app"]);

type Sample = {
  width: number;
  height: number;
  fps?: number;
  dropped?: number;
  latency?: number;
};

const sample = shallowRef<Sample>();
let lastFrames: number | undefined;
let lastAt = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function video(): HTMLVideoElement | undefined {
  if (props.layer === "recording") return props.recording ?? undefined;
  const el = props.liveSession?.element;
  return el instanceof HTMLVideoElement ? el : undefined;
}

function measure() {
  const el = video();
  if (!el) {
    const res = props.liveSession?.resolution.value;
    sample.value = res ? { width: res.width, height: res.height } : undefined;
    lastFrames = undefined;
    return;
  }
  const quality = el.getVideoPlaybackQuality?.();
  const now = performance.now();
  let fps: number | undefined;
  if (quality && lastFrames !== undefined && now > lastAt) {
    fps = ((quality.totalVideoFrames - lastFrames) * 1000) / (now - lastAt);
  }
  lastFrames = quality?.totalVideoFrames;
  lastAt = now;

  let latency: number | undefined;
  if (props.layer === "live" && el.buffered.length) {
    latency = el.buffered.end(el.buffered.length - 1) - el.currentTime;
  }
  sample.value = {
    width: el.videoWidth,
    height: el.videoHeight,
    fps,
    dropped: quality?.droppedVideoFrames,
    latency,
  };
}

onMounted(() => {
  measure();
  timer = setInterval(measure, 1000);
});
onBeforeUnmount(() => clearInterval(timer));

const source = computed(() =>
  props.layer === "live"
    ? (props.liveMode ?? "").toUpperCase()
    : t("player.recording"),
);
</script>

<template>
  <dl class="stream-stats" :aria-label="t('player.stats')">
    <div>
      <dt>{{ t("player.statsSource") }}</dt>
      <dd>{{ source }}</dd>
    </div>
    <div v-if="sample?.width">
      <dt>{{ t("player.statsResolution") }}</dt>
      <dd>{{ sample.width }}×{{ sample.height }}</dd>
    </div>
    <div v-if="sample?.fps !== undefined">
      <dt>{{ t("player.statsFps") }}</dt>
      <dd>{{ sample.fps.toFixed(1) }}</dd>
    </div>
    <div v-if="sample?.dropped !== undefined">
      <dt>{{ t("player.statsDropped") }}</dt>
      <dd>{{ sample.dropped }}</dd>
    </div>
    <div v-if="sample?.latency !== undefined">
      <dt>{{ t("player.statsLatency") }}</dt>
      <dd>{{ sample.latency.toFixed(2) }}s</dd>
    </div>
  </dl>
</template>

<style scoped>
.stream-stats {
  position: absolute;
  inset-block-start: 48px;
  inset-inline-start: 12px;
  z-index: 6;
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--line-overlay);
  background: var(--bg-overlay-control);
  backdrop-filter: blur(12px);
  color: var(--text-on-media);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  pointer-events: none;

  div {
    display: flex;
    justify-content: space-between;
    gap: 16px;
  }

  dt {
    color: var(--text-on-media-muted);
  }

  dd {
    margin: 0;
  }
}
</style>
