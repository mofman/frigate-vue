<script setup lang="ts">
/**
 * The camera stage composites three persistent layers: live, recording and
 * scrub preview. Layers are never unmounted. A switch freezes the current
 * frame (FrameHold), prepares the next layer while hidden, and only reveals
 * it once it has painted a frame. Geometry is fixed per camera so nothing
 * shifts when the source changes.
 */
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { baseUrl } from "@/api/baseUrl";
import { RecordingPlayer } from "@/players/recording";
import type { Playback } from "@/composables/usePlayback";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import FrameHold from "./FrameHold.vue";
import LiveVideo from "./LiveVideo.vue";
import PreviewScrubber from "./PreviewScrubber.vue";

const props = withDefaults(
  defineProps<{
    camera: CameraConfig;
    playback: Playback;
    muted?: boolean;
    preferredStream?: string;
    lowBandwidth?: boolean;
    playInBackground?: boolean;
    /** how long live stays connected after switching to recordings */
    liveWarmMs?: number;
  }>(),
  {
    muted: true,
    preferredStream: undefined,
    lowBandwidth: false,
    playInBackground: false,
    liveWarmMs: 60_000,
  },
);

const emit = defineEmits<{ switched: [kind: string, ms: number] }>();

const { t } = useT(["views/app"]);
type Layer = "live" | "recording" | "preview";

const visible = shallowRef<Layer>(props.playback.mode.value);
const liveEnabled = shallowRef(true);
const liveFrames = shallowRef(0);
const liveFailed = shallowRef(false);
const previewHasFrame = shallowRef(false);

const liveRef = shallowRef<InstanceType<typeof LiveVideo> | null>(null);
const previewRef = shallowRef<InstanceType<typeof PreviewScrubber> | null>(
  null,
);
const holdRef = shallowRef<InstanceType<typeof FrameHold> | null>(null);
const videoRef = shallowRef<HTMLVideoElement | null>(null);
const stageRef = shallowRef<HTMLDivElement | null>(null);
const recorder = shallowRef<RecordingPlayer>();

const aspect = computed(() => {
  const { width, height } = props.camera.detect;
  return width && height ? width / height : 16 / 9;
});
const poster = computed(
  () =>
    `${baseUrl}api/${props.camera.name}/latest.webp?height=${Math.min(props.camera.detect.height || 720, 1080)}`,
);

const playback = props.playback;
const liveParked = computed(
  () => visible.value !== "live" && !pendingLive.value,
);
const pendingLive = shallowRef(false);

// ---- transition machinery -------------------------------------------------

let token = 0;

function frameSource() {
  switch (visible.value) {
    case "live":
      return liveRef.value?.frameSource();
    case "recording":
      return videoRef.value ?? undefined;
    case "preview":
      return previewRef.value?.frameSource();
  }
}

/** Resolve when `changed()` is true or after the timeout. */
function waitFor(changed: () => boolean, timeout: number) {
  return new Promise<void>((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (changed() || performance.now() - started > timeout) resolve();
      else requestAnimationFrame(tick);
    };
    tick();
  });
}

/**
 * Freeze the screen, run `prepare`, wait for `ready`, then reveal `target`
 * and let the frozen frame fade off it.
 */
async function transition(
  target: Layer,
  prepare: () => unknown,
  ready: () => boolean,
  label: string,
) {
  const mine = ++token;
  const started = performance.now();
  holdRef.value?.capture(frameSource());
  await prepare();
  await waitFor(() => ready() || mine !== token, 6000);
  if (mine !== token) return;
  visible.value = target;
  requestAnimationFrame(() => {
    if (mine !== token) return;
    holdRef.value?.release();
    emit("switched", label, performance.now() - started);
  });
}

// ---- live ------------------------------------------------------------------

let liveReleaseTimer: ReturnType<typeof setTimeout> | undefined;

function showLive() {
  clearTimeout(liveReleaseTimer);
  recorder.value?.pause();
  const before = liveFrames.value;
  const status = liveRef.value?.status;
  // a stream handed over from a dashboard tile is already on screen
  if (visible.value === "live" && status === "playing") {
    token++;
    holdRef.value?.release();
    return;
  }
  pendingLive.value = true;
  liveEnabled.value = true;
  void transition(
    "live",
    () => undefined,
    () => liveFrames.value !== before || liveFailed.value,
    "live",
  ).finally(() => (pendingLive.value = false));
}

function scheduleLiveRelease() {
  clearTimeout(liveReleaseTimer);
  liveReleaseTimer = setTimeout(() => {
    if (playback.mode.value !== "live") liveEnabled.value = false;
  }, props.liveWarmMs);
}

// ---- recording ---------------------------------------------------------------

async function showRecording(time: number, play: boolean) {
  const player = recorder.value;
  if (!player) return;

  // seeks inside the visible recording are plain seeks: the element keeps
  // its last frame on screen until the new one decodes
  if (visible.value === "recording" && player.covers(props.camera.name, time)) {
    token++;
    holdRef.value?.release();
    player.seek(time, play);
    return;
  }

  const before = player.firstFrameAt.value;
  await transition(
    "recording",
    () => player.prepare(props.camera.name, time, { play }),
    () =>
      player.firstFrameAt.value !== before ||
      player.status.value === "empty" ||
      player.status.value === "error",
    "recording",
  );
  scheduleLiveRelease();
}

// ---- wiring ------------------------------------------------------------------

watch(playback.mode, (mode) => {
  if (mode === "live") showLive();
});

watch(playback.seekRequest, (request) => {
  if (playback.mode.value === "recording")
    void showRecording(request.time, request.play);
});

watch(playback.scrubbing, (scrubbing) => {
  if (scrubbing) {
    recorder.value?.pause();
    previewHasFrame.value = false;
  } else if (visible.value === "preview" && playback.mode.value === "live") {
    // released at the live edge without leaving live
    showLive();
  }
});

watch(previewHasFrame, (has) => {
  if (has && playback.scrubbing.value) {
    token++;
    holdRef.value?.release();
    visible.value = "preview";
  }
});

watch(playback.playing, (playing) => {
  if (playback.mode.value !== "recording" || playback.scrubbing.value) return;
  if (playing) recorder.value?.play();
  else recorder.value?.pause();
});

watch(
  () => props.camera.name,
  (camera) => {
    liveFailed.value = false;
    if (playback.mode.value === "live") {
      const before = liveFrames.value;
      void transition(
        "live",
        () => undefined,
        () => liveFrames.value !== before || liveFailed.value,
        "camera",
      );
    } else {
      const player = recorder.value;
      if (!player) return;
      const before = player.firstFrameAt.value;
      const time = playback.time.value;
      void transition(
        "recording",
        () => player.prepare(camera, time, { play: playback.playing.value }),
        () =>
          player.firstFrameAt.value !== before ||
          player.status.value !== "loading",
        "camera",
      );
    }
  },
);

// pre-warm recordings while live so the first scrub back is a seek
let prewarmTimer: ReturnType<typeof setInterval> | undefined;
function prewarm() {
  if (playback.mode.value !== "live" || document.visibilityState !== "visible")
    return;
  void recorder.value?.prepare(props.camera.name, Date.now() / 1000 - 30, {
    load: false,
  });
}

onMounted(() => {
  if (!videoRef.value) return;
  const player = new RecordingPlayer(videoRef.value);
  recorder.value = player;
  player.onEnded = () => playback.reportEnded();
  watch(player.timestamp, (ts) => ts !== undefined && playback.reportTime(ts));
  watch(
    () => player.source,
    () => (playback.recordedUntil.value = player.recordedUntil),
  );
  watch(
    player.status,
    () => (playback.recordedUntil.value = player.recordedUntil),
  );

  if (playback.mode.value === "recording") {
    void showRecording(playback.time.value, playback.playing.value);
  } else {
    holdRef.value?.capture(undefined);
    showLive();
  }
  setTimeout(prewarm, 2000);
  prewarmTimer = setInterval(prewarm, 2 * 60_000);
});

onBeforeUnmount(() => {
  token++;
  clearTimeout(liveReleaseTimer);
  clearInterval(prewarmTimer);
  recorder.value?.destroy();
});

const recordingStatus = computed(() => recorder.value?.status.value);
const loading = computed(() => {
  if (visible.value === "live")
    return liveRef.value?.status !== "playing" && !liveFailed.value;
  if (visible.value === "recording")
    return (
      !!recorder.value?.buffering.value || recordingStatus.value === "loading"
    );
  return false;
});
const holdVisible = computed(() => holdRef.value?.visible ?? false);

defineExpose({ stage: stageRef });
</script>

<template>
  <div class="stage-frame">
    <div
      ref="stageRef"
      class="stage"
      :style="{ '--aspect': aspect }"
      :data-layer="visible"
    >
      <div class="stage__layer" :class="{ 'is-active': visible === 'live' }">
        <LiveVideo
          ref="liveRef"
          :camera="camera"
          :enabled="liveEnabled"
          :parked="liveParked"
          :muted="muted || visible !== 'live'"
          :preferred-stream="preferredStream"
          :low-bandwidth="lowBandwidth"
          :background="playInBackground"
          @frame="liveFrames++"
          @failed="liveFailed = true"
        />
      </div>
      <div
        class="stage__layer"
        :class="{ 'is-active': visible === 'recording' }"
      >
        <video
          ref="videoRef"
          class="stage__video"
          :muted="muted || visible !== 'recording'"
          playsinline
        />
      </div>
      <div class="stage__layer" :class="{ 'is-active': visible === 'preview' }">
        <PreviewScrubber
          ref="previewRef"
          :camera="camera.name"
          :time="playback.scrubTime.value"
          :active="playback.scrubbing.value"
          @frame="previewHasFrame = $event"
        />
      </div>

      <FrameHold ref="holdRef" :poster="poster" />

      <div v-if="loading && !holdVisible" class="stage__status">
        <LoadingSpinner :label="t('player.loading')" />
      </div>
      <div v-else-if="loading" class="stage__status stage__status--corner">
        <LoadingSpinner :size="16" :delay="600" :label="t('player.loading')" />
      </div>

      <div
        v-if="visible === 'recording' && recordingStatus === 'empty'"
        class="stage__message"
      >
        {{ t("player.noRecordings") }}
      </div>
      <div
        v-else-if="visible === 'recording' && recordingStatus === 'error'"
        class="stage__message"
      >
        {{ t("player.recordingError") }}
      </div>
      <div v-else-if="visible === 'live' && liveFailed" class="stage__message">
        {{ t("player.liveError") }}
      </div>

      <div class="stage__overlay">
        <slot :layer="visible" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-frame {
  container-type: size;
  position: relative;
  display: grid;
  place-items: center;
  inline-size: 100%;
  block-size: 100%;
  min-block-size: 0;
}

.stage {
  position: relative;
  aspect-ratio: var(--aspect);
  /* fit inside the frame without ever changing shape */
  inline-size: min(100cqi, 100cqb * var(--aspect));
  overflow: hidden;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-card);
  view-transition-name: camera-stage;
  transition:
    border-color var(--dur),
    box-shadow var(--dur);

  &:has(.stage__overlay [data-activity="true"]) {
    border-color: color-mix(in srgb, var(--alert-amber) 60%, transparent);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--alert-amber) 14%, transparent);
  }
}

.stage__layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  visibility: hidden;

  &.is-active {
    z-index: 2;
    opacity: 1;
    visibility: visible;
  }
}

.stage__video {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
  background: var(--bg-media);
}

.stage__status {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.stage__status--corner {
  inset: auto 12px 12px auto;
}

.stage__message {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  padding: 16px;
  text-align: center;
  font-size: var(--text-base);
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-media) 70%, transparent);
  pointer-events: none;
}

.stage__overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  /* overlay content opts back in for its interactive parts */
  pointer-events: none;
}
</style>
