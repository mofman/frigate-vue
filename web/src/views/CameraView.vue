<script setup lang="ts">
/**
 * Unified camera view: live and recordings in one place. The stage, timeline
 * and controls share one playback state. Switching cameras swaps the stage
 * source in place instead of remounting the page.
 */
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, ChevronDown, Video } from "@lucide/vue";
import PageHeader from "@/components/layout/PageHeader.vue";
import CameraStage from "@/components/player/CameraStage.vue";
import ModeBadge from "@/components/player/ModeBadge.vue";
import StageControls from "@/components/player/StageControls.vue";
import CameraOverlay from "@/components/camera/CameraOverlay.vue";
import CameraStrip from "@/components/camera/CameraStrip.vue";
import CameraTimestamp from "@/components/camera/CameraTimestamp.vue";
import ActivityTags from "@/components/camera/ActivityTags.vue";
import ReviewTimeline from "@/components/timeline/ReviewTimeline.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import IconButton from "@/components/ui/IconButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import { useQuery } from "@/api/query";
import { onWsMessage } from "@/api/ws";
import { cameraLabel, useCameras } from "@/composables/useFrigate";
import { useCameraActivity } from "@/composables/useCameraActivity";
import { usePlayback } from "@/composables/usePlayback";
import {
  useFullscreen,
  useMediaQuery,
  usePersistedRef,
} from "@/composables/useUtil";
import { useT } from "@/composables/useT";
import { useManualRecording } from "@/composables/useManualRecording";
import { useStreamAudio } from "@/composables/useStreamAudio";
import { usePtz } from "@/composables/usePtz";
import PtzClickLayer from "@/components/player/PtzClickLayer.vue";
import PtzPanel from "@/components/player/PtzPanel.vue";
import { cameraStreams } from "@/players/streams";
import { saveSnapshot } from "@/utils/snapshot";
import { REVIEW_PADDING, reviewStart } from "@/utils/review";
import CameraActions from "@/components/camera/CameraActions.vue";
import RangePicker from "@/components/camera/RangePicker.vue";
import EventList from "@/components/review/EventList.vue";
import ReviewDetail from "@/components/review/ReviewDetail.vue";
import ReviewFilter, {
  type ReviewFilterValue,
} from "@/components/review/ReviewFilter.vue";
import SegmentedToggle from "@/components/ui/SegmentedToggle.vue";
import type { ReviewSegment } from "@/types/frigate";

const props = defineProps<{ name: string }>();
const { t } = useT(["views/app"]);
const route = useRoute();
const router = useRouter();
const cameras = useCameras();
const camera = computed(() =>
  cameras.value.find((cam) => cam.name === props.name),
);

const initialTime = Number(route.query.t);
const playback = usePlayback(
  Number.isFinite(initialTime) && initialTime > 0
    ? { initialMode: "recording", initialTime }
    : { initialMode: "live" },
);

// ---- per camera preferences -------------------------------------------------

const muted = usePersistedRef("stage-muted", true);
const volume = usePersistedRef("stage-volume", 1);
const showStats = usePersistedRef("stage-stats", false);
/** two way talk is never remembered, it holds the microphone */
const talk = shallowRef(false);
const lowBandwidth = usePersistedRef("stage-low-bandwidth", false);
const playInBackground = usePersistedRef("stage-background", false);
const streams = usePersistedRef<Record<string, string>>("stage-streams", {});
const stream = computed({
  get: () => streams.value[props.name],
  set: (value?: string) => {
    const next = { ...streams.value };
    if (value) next[props.name] = value;
    else delete next[props.name];
    streams.value = next;
  },
});

// ---- data --------------------------------------------------------------------

// ---- toolbar: range, filter, side panel ------------------------------------

const rangeHours = usePersistedRef("camera-range-hours", 24);
watch(
  rangeHours,
  (hours) => (playback.earliest.value = Date.now() / 1000 - hours * 3600),
  { immediate: true },
);

const filter = shallowRef<ReviewFilterValue>({
  severity: "all",
  labels: [],
  zones: [],
});
const trackedLabels = computed(() => camera.value?.objects?.track ?? []);
const zoneNames = computed(() => Object.keys(camera.value?.zones ?? {}));

type Panel = "timeline" | "events" | "detail";
const panel = usePersistedRef<Panel>("camera-panel", "timeline");
const panelOptions = computed(() => [
  { value: "timeline" as const, label: t("toolbar.timeline"), text: true },
  { value: "events" as const, label: t("toolbar.events"), text: true },
  { value: "detail" as const, label: t("toolbar.detail"), text: true },
]);

// the hour floor keeps this key stable while the range is unchanged
const reviewsKey = computed(
  () =>
    [
      "review",
      {
        cameras: props.name,
        after: Math.floor(playback.earliest.value / 3600) * 3600,
        reviewed: undefined,
        severity:
          filter.value.severity === "all" ? undefined : filter.value.severity,
        labels: filter.value.labels.join(",") || undefined,
        zones: filter.value.zones.join(",") || undefined,
      },
    ] as const,
);
const { data: reviews, refresh: refreshReviews } = useQuery<ReviewSegment[]>(
  reviewsKey,
  { staleTime: 15_000 },
);
onWsMessage("reviews", () => void refreshReviews());
// the list may hold other cameras' items while a camera switch is in flight
const cameraReviews = computed(() =>
  (reviews.value ?? []).filter((review) => review.camera === props.name),
);

/** the review under the playhead, else the latest one before it */
const currentReview = computed(() => {
  const time = playback.isLive.value
    ? Date.now() / 1000
    : playback.displayTime.value;
  let best: ReviewSegment | undefined;
  for (const review of cameraReviews.value) {
    const end = review.end_time ?? Infinity;
    if (review.start_time - REVIEW_PADDING <= time && time <= end + 5)
      return review;
    if (
      review.start_time <= time &&
      (!best || review.start_time > best.start_time)
    )
      best = review;
  }
  return best;
});

function openReview(review: ReviewSegment) {
  playback.seek(reviewStart(review), true);
}

const activity = useCameraActivity(() => props.name);

// ---- stage actions -------------------------------------------------------

const stageRef = shallowRef<InstanceType<typeof CameraStage> | null>(null);
const manual = useManualRecording(() => props.name);
const recordingNow = computed(() => !!manual.eventId.value);
const snapshotBusy = shallowRef(false);

const audioStream = computed(
  () =>
    stream.value ??
    (camera.value ? cameraStreams(camera.value)[0]?.[1] : undefined),
);
const audio = useStreamAudio(audioStream);
const supportsTalk = computed(
  () => audio.twoWayTalk.value && !lowBandwidth.value,
);

watch(
  () => props.name,
  () => (talk.value = false),
);

// ---- ptz -------------------------------------------------------------------

const ptz = usePtz(camera);
const clickMove = shallowRef(false);
const showPtz = computed(() => playback.isLive.value && ptz.available.value);
watch([() => props.name, showPtz], () => (clickMove.value = false));

const PTZ_KEYS: Record<string, string> = {
  ArrowLeft: "MOVE_LEFT",
  ArrowRight: "MOVE_RIGHT",
  ArrowUp: "MOVE_UP",
  ArrowDown: "MOVE_DOWN",
};
let ptzKeyHeld = false;

/** Keyboard PTZ while live. Returns true when the key was used. */
function ptzKey(event: KeyboardEvent) {
  if (!showPtz.value) return false;
  const move = PTZ_KEYS[event.key];
  let command: string | undefined;
  if (move && ptz.canMove.value) command = move;
  else if ((event.key === "+" || event.key === "=") && ptz.canZoom.value)
    command = event.shiftKey && ptz.canFocus.value ? "FOCUS_IN" : "ZOOM_IN";
  else if ((event.key === "-" || event.key === "_") && ptz.canZoom.value)
    command = event.shiftKey && ptz.canFocus.value ? "FOCUS_OUT" : "ZOOM_OUT";
  else if (/^[1-9]$/.test(event.key)) {
    const preset = ptz.presets.value[Number(event.key) - 1];
    if (preset) ptz.send(`preset_${preset}`);
    return !!preset;
  }
  if (!command) return false;
  event.preventDefault();
  // key repeat would flood the camera with the same move
  if (!event.repeat) {
    ptz.send(command);
    ptzKeyHeld = true;
  }
  return true;
}

function onKeyUp() {
  if (!ptzKeyHeld) return;
  ptzKeyHeld = false;
  ptz.send("STOP");
}

async function takeSnapshot() {
  if (snapshotBusy.value) return;
  snapshotBusy.value = true;
  try {
    await saveSnapshot(props.name, {
      source: stageRef.value?.activeFrame(),
      time: playback.isLive.value ? undefined : playback.time.value,
    });
  } finally {
    snapshotBusy.value = false;
  }
}

// ---- url sync --------------------------------------------------------------

watch(playback.seekRequest, (request) => {
  void router.replace({
    query: { ...route.query, t: Math.floor(request.time) },
  });
});
watch(playback.mode, (mode) => {
  if (mode === "live" && route.query.t) {
    const { t: _drop, ...rest } = route.query;
    void router.replace({ query: rest });
  }
});

function selectCamera(name: string) {
  const query =
    playback.mode.value === "recording"
      ? { t: Math.floor(playback.time.value) }
      : {};
  void router.replace({ name: "camera", params: { name }, query });
}

// ---- fullscreen & layout -----------------------------------------------------

const stageColumn = shallowRef<HTMLElement | null>(null);
const {
  isFullscreen,
  supported: supportsFullscreen,
  toggle: toggleFullscreen,
} = useFullscreen(stageColumn, () => stageRef.value?.activeVideo());
const desktop = useMediaQuery("(min-width: 769px)");
const wide = useMediaQuery("(min-width: 1380px)");

// ---- keyboard ------------------------------------------------------------------

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    return;
  if (ptzKey(event)) return;
  switch (event.key) {
    case " ":
      if (playback.isLive.value) return;
      event.preventDefault();
      playback.setPlaying(!playback.playing.value);
      break;
    case "ArrowLeft":
      event.preventDefault();
      playback.seek(
        (playback.isLive.value ? Date.now() / 1000 : playback.time.value) - 10,
        true,
      );
      break;
    case "ArrowRight":
      if (playback.isLive.value) return;
      event.preventDefault();
      playback.seek(playback.time.value + 10, playback.playing.value);
      break;
    case "l":
    case "L":
      playback.goLive();
      break;
    case "f":
    case "F":
      void toggleFullscreen();
      break;
    case "m":
    case "M":
      muted.value = !muted.value;
      break;
    case "t":
    case "T":
      if (!supportsTalk.value || !playback.isLive.value) return;
      talk.value = !talk.value;
      if (talk.value) muted.value = false;
      break;
    case "Escape":
      // Escape leaves fullscreen first, the browser handles that
      if (isFullscreen.value || document.querySelector(":popover-open")) return;
      void router.push("/");
      break;
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
  window.removeEventListener("keyup", onKeyUp);
  onKeyUp();
});

// ---- dev metrics -------------------------------------------------------------

function onSwitched(kind: string, ms: number) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[stage] ${kind} switch painted in ${Math.round(ms)}ms`);
  }
}
</script>

<template>
  <div class="camera-view">
    <PageHeader>
      <template #start>
        <IconButton
          :label="t('nav.back')"
          :show-label="desktop"
          @click="router.push('/')"
        >
          <ArrowLeft />
        </IconButton>
        <IconButton
          :label="t('player.live')"
          :show-label="desktop"
          :active="playback.isLive.value"
          @click="playback.goLive()"
        >
          <Video />
        </IconButton>
      </template>
      <template #actions>
        <PopoverMenu align="end" width="240px">
          <template #trigger="{ popovertarget }">
            <button
              type="button"
              class="camera-view__picker"
              :popovertarget="popovertarget"
            >
              <Video :size="16" aria-hidden="true" />
              {{ cameraLabel(camera, name) }}
              <ChevronDown :size="14" aria-hidden="true" />
            </button>
          </template>
          <template #default="{ close }">
            <MenuItem
              v-for="cam in cameras"
              :key="cam.name"
              :selected="cam.name === name"
              @click="
                selectCamera(cam.name);
                close();
              "
            >
              {{ cameraLabel(cam) }}
            </MenuItem>
          </template>
        </PopoverMenu>
        <RangePicker v-model="rangeHours" :show-label="wide" />
        <ReviewFilter
          v-model="filter"
          :labels="trackedLabels"
          :zones="zoneNames"
          :show-label="wide"
        />
        <CameraActions
          :camera="name"
          :time="playback.time.value"
          :live="playback.isLive.value"
          :show-label="wide"
        />
        <SegmentedToggle
          v-if="desktop"
          v-model="panel"
          class="camera-view__panels"
          :label="t('toolbar.panel')"
          :options="panelOptions"
        />
      </template>
    </PageHeader>

    <div v-if="camera" class="camera-view__body" :data-panel="panel">
      <section ref="stageColumn" class="camera-view__stage-column">
        <div class="camera-view__backdrop" aria-hidden="true" />
        <div class="camera-view__stage">
          <CameraStage
            ref="stageRef"
            :camera="camera"
            :playback="playback"
            :muted="muted"
            :volume="volume"
            :talk="talk && playback.isLive.value"
            :show-stats="showStats"
            :zoomable="!(showPtz && clickMove)"
            :preferred-stream="stream"
            :low-bandwidth="lowBandwidth"
            :play-in-background="playInBackground"
            @switched="onSwitched"
            @talk-failed="talk = false"
          >
            <PtzClickLayer
              v-if="showPtz && clickMove"
              @move="ptz.send($event)"
            />
            <CameraOverlay>
              <template #top-start>
                <ModeBadge
                  :live="playback.isLive.value"
                  :scrubbing="playback.scrubbing.value"
                />
              </template>
              <template v-if="!playback.isLive.value" #top-end>
                <CameraTimestamp
                  size="md"
                  :time="
                    playback.isLive.value
                      ? undefined
                      : playback.displayTime.value
                  "
                />
              </template>
              <template #bottom-start>
                <ActivityTags
                  v-if="playback.isLive.value"
                  :data-activity="
                    activity.activeTracking.value || activity.activeMotion.value
                  "
                  :objects="activity.objects.value"
                  :motion="activity.activeMotion.value"
                  size="md"
                />
              </template>
              <template #bottom-end>
                <PtzPanel
                  v-if="showPtz"
                  v-model:click-move="clickMove"
                  :ptz="ptz"
                />
              </template>
            </CameraOverlay>
            <div class="camera-view__controls">
              <StageControls
                v-model:muted="muted"
                v-model:volume="volume"
                v-model:talk="talk"
                v-model:stream="stream"
                v-model:low-bandwidth="lowBandwidth"
                v-model:play-in-background="playInBackground"
                v-model:show-stats="showStats"
                :camera="camera"
                :playback="playback"
                :fullscreen="isFullscreen"
                :supports-fullscreen="supportsFullscreen"
                :supports-talk="supportsTalk"
                :has-audio="audio.audioOutput.value"
                :recording="recordingNow"
                :snapshot-busy="snapshotBusy"
                @toggle-fullscreen="toggleFullscreen"
                @toggle-record="manual.toggle()"
                @snapshot="takeSnapshot"
              />
            </div>
          </CameraStage>
        </div>
        <CameraStrip
          v-if="desktop"
          :cameras="cameras"
          :current="name"
          @select="selectCamera"
        />
      </section>
      <aside class="camera-view__side">
        <SegmentedToggle
          v-if="!desktop"
          v-model="panel"
          class="camera-view__panels camera-view__panels--inline"
          :label="t('toolbar.panel')"
          :options="panelOptions"
        />
        <ReviewTimeline
          v-if="panel === 'timeline'"
          class="camera-view__timeline"
          :camera="name"
          :playback="playback"
          :reviews="cameraReviews"
        />
        <EventList
          v-else-if="panel === 'events'"
          :reviews="cameraReviews"
          :current="currentReview?.id"
          @open="openReview"
        />
        <ReviewDetail
          v-else
          :review="currentReview"
          @seek="playback.seek($event, true)"
        />
      </aside>
    </div>
    <EmptyState v-else-if="cameras.length" :title="t('camera.notFound')" />
  </div>
</template>

<style scoped>
.camera-view {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  min-block-size: 0;
  background: var(--bg-stage);
}

.camera-view__picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  block-size: 34px;
  padding-inline: 12px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--glass-border);
  background: var(--bg-elevated);
  font-size: var(--text-base);
  font-weight: 600;
  text-transform: capitalize;
  transition:
    border-color var(--dur),
    background var(--dur);

  &:hover {
    border-color: var(--line-hover);
    background: var(--bg-hover);
  }

  svg {
    color: var(--text-tertiary);
  }
}

.camera-view__body {
  flex: 1;
  min-block-size: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--timeline-width);

  &:is([data-panel="events"], [data-panel="detail"]) {
    grid-template-columns: minmax(0, 1fr) var(--side-panel-width);
  }
}

.camera-view__side {
  display: flex;
  flex-direction: column;
  min-block-size: 0;
  min-inline-size: 0;
  background: var(--bg-panel);

  .camera-view__body:not([data-panel="timeline"]) & {
    border-inline-start: 1px solid var(--glass-border);
  }

  > :last-child {
    flex: 1;
    min-block-size: 0;
  }
}

.camera-view__panels--inline {
  align-self: center;
  margin-block: 8px;
}

.camera-view__stage-column {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-inline-size: 0;
  min-block-size: 0;
  padding: 16px;
  isolation: isolate;
}

.camera-view__backdrop {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: var(--backdrop-stage);
}

.camera-view__stage {
  flex: 1;
  min-block-size: 0;
}

.camera-view__controls {
  position: absolute;
  inset: 0;
  z-index: 7;
  pointer-events: none;
}

.camera-view__stage-column:fullscreen {
  padding: 0;
  background: var(--bg-media);

  .camera-view__backdrop {
    display: none;
  }
}

.camera-view__stage-column:fullscreen :deep(.stage) {
  border: none;
  border-radius: 0;
}

@media (max-width: 768px) {
  /* the camera view keeps a fixed screen layout: stage above, timeline below */
  .camera-view {
    block-size: calc(
      100dvh - var(--tabbar-height) - env(safe-area-inset-bottom)
    );
  }

  .camera-view__body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .camera-view__stage-column {
    padding: 8px;
  }

  .camera-view__stage {
    flex: none;
    aspect-ratio: 16 / 10;
  }

  .camera-view__body:is([data-panel="events"], [data-panel="detail"]) {
    grid-template-columns: minmax(0, 1fr);
  }

  .camera-view__side {
    border-inline-start: none;
    border-block-start: 1px solid var(--glass-border);
  }
}
</style>
