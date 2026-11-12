<script setup lang="ts">
/**
 * Stage controls, switching set by mode: live buttons sit top right, the
 * recorded playback bar sits bottom centre.
 */
import { computed } from "vue";
import type { Playback } from "@/composables/usePlayback";
import type { CameraConfig } from "@/types/frigate";
import LiveControls from "./LiveControls.vue";
import PlaybackBar from "./PlaybackBar.vue";

const props = defineProps<{
  camera: CameraConfig;
  playback: Playback;
  fullscreen: boolean;
  supportsFullscreen: boolean;
  supportsTalk: boolean;
  hasAudio: boolean;
  recording: boolean;
  snapshotBusy: boolean;
}>();
const emit = defineEmits<{
  toggleFullscreen: [];
  toggleRecord: [];
  snapshot: [];
}>();

const muted = defineModel<boolean>("muted", { required: true });
const volume = defineModel<number>("volume", { required: true });
const talk = defineModel<boolean>("talk", { required: true });
const stream = defineModel<string | undefined>("stream", { required: true });
const lowBandwidth = defineModel<boolean>("lowBandwidth", { required: true });
const playInBackground = defineModel<boolean>("playInBackground", {
  required: true,
});
const showStats = defineModel<boolean>("showStats", { required: true });

const live = computed(() => props.playback.isLive.value);
</script>

<template>
  <div class="stage-controls" :data-mode="live ? 'live' : 'recording'">
    <LiveControls
      v-if="live"
      v-model:muted="muted"
      v-model:talk="talk"
      v-model:stream="stream"
      v-model:low-bandwidth="lowBandwidth"
      v-model:play-in-background="playInBackground"
      v-model:show-stats="showStats"
      :camera="camera"
      :fullscreen="fullscreen"
      :supports-fullscreen="supportsFullscreen"
      :supports-talk="supportsTalk"
      :has-audio="hasAudio"
      :recording="recording"
      :snapshot-busy="snapshotBusy"
      @toggle-fullscreen="emit('toggleFullscreen')"
      @toggle-record="emit('toggleRecord')"
      @snapshot="emit('snapshot')"
    />
    <PlaybackBar
      v-else
      v-model:muted="muted"
      v-model:volume="volume"
      :playback="playback"
      :fullscreen="fullscreen"
      :supports-fullscreen="supportsFullscreen"
      :snapshot-busy="snapshotBusy"
      @toggle-fullscreen="emit('toggleFullscreen')"
      @snapshot="emit('snapshot')"
    />
  </div>
</template>

<style scoped>
.stage-controls {
  position: absolute;
  inset-inline: 0;
  display: flex;
  padding: 10px 12px;
  pointer-events: none;

  &[data-mode="live"] {
    inset-block-start: 0;
    justify-content: flex-end;
  }

  &[data-mode="recording"] {
    inset-block-end: 0;
    justify-content: center;
    padding-block-end: 6px;
  }
}
</style>
