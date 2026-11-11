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

// earliest is fixed for the life of the view so this key never churns
const reviewsKey = computed(
  () =>
    [
      "review",
      {
        cameras: props.name,
        after: Math.floor(playback.earliest.value / 3600) * 3600,
        reviewed: undefined,
      },
    ] as const,
);
const { data: reviews, refresh: refreshReviews } = useQuery<ReviewSegment[]>(
  reviewsKey,
  { staleTime: 15_000 },
);
onWsMessage("reviews", () => void refreshReviews());

const activity = useCameraActivity(() => props.name);

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
} = useFullscreen(stageColumn);
const desktop = useMediaQuery("(min-width: 769px)");

// ---- keyboard ------------------------------------------------------------------

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    return;
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
  }
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

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
      </template>
    </PageHeader>

    <div v-if="camera" class="camera-view__body">
      <section ref="stageColumn" class="camera-view__stage-column">
        <div class="camera-view__backdrop" aria-hidden="true" />
        <div class="camera-view__stage">
          <CameraStage
            :camera="camera"
            :playback="playback"
            :muted="muted"
            :preferred-stream="stream"
            :low-bandwidth="lowBandwidth"
            :play-in-background="playInBackground"
            @switched="onSwitched"
          >
            <CameraOverlay>
              <template #top-start>
                <ModeBadge
                  :live="playback.isLive.value"
                  :scrubbing="playback.scrubbing.value"
                />
              </template>
              <template #top-end>
                <CameraTimestamp
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
                  :data-activity="activity.activeTracking.value"
                  :objects="activity.objects.value"
                  :motion="activity.activeMotion.value"
                />
              </template>
            </CameraOverlay>
            <div class="camera-view__controls">
              <StageControls
                v-model:muted="muted"
                v-model:stream="stream"
                v-model:low-bandwidth="lowBandwidth"
                v-model:play-in-background="playInBackground"
                :camera="camera"
                :playback="playback"
                :fullscreen="isFullscreen"
                :supports-fullscreen="supportsFullscreen"
                @toggle-fullscreen="toggleFullscreen"
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
      <ReviewTimeline
        class="camera-view__timeline"
        :camera="name"
        :playback="playback"
        :reviews="reviews ?? []"
      />
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
  inset: auto 0 0;
  z-index: 7;
  display: flex;
  padding: 10px 12px;
  pointer-events: none;
}

/* the overlay bottom row holds tags, controls sit to the right of them */
.camera-view__stage :deep(.camera-overlay__bottom) {
  padding-block-end: 52px;
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

  .camera-view__timeline {
    border-inline-start: none;
    border-block-start: 1px solid var(--glass-border);
  }
}
</style>
