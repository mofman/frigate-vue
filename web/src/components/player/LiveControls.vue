<script setup lang="ts">
/** Live stage buttons, top right: view, talk, audio, record, still, settings. */
import {
  Camera,
  CircleDot,
  CircleStop,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Volume2,
  VolumeX,
} from "@lucide/vue";
import OverlayButton from "@/components/ui/OverlayButton.vue";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";
import LiveSettingsMenu from "./LiveSettingsMenu.vue";

defineProps<{
  camera: CameraConfig;
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
const talk = defineModel<boolean>("talk", { required: true });
const stream = defineModel<string | undefined>("stream", { required: true });
const lowBandwidth = defineModel<boolean>("lowBandwidth", { required: true });
const playInBackground = defineModel<boolean>("playInBackground", {
  required: true,
});
const showStats = defineModel<boolean>("showStats", { required: true });

const { t } = useT(["views/app"]);

function toggleTalk() {
  talk.value = !talk.value;
  // hearing the other side is the point of talking
  if (talk.value) muted.value = false;
}
</script>

<template>
  <div class="live-controls">
    <OverlayButton
      v-if="supportsFullscreen"
      size="md"
      :label="fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')"
      @click="emit('toggleFullscreen')"
    >
      <Minimize2 v-if="fullscreen" />
      <Maximize2 v-else />
    </OverlayButton>
    <OverlayButton
      v-if="supportsTalk"
      size="md"
      :label="talk ? t('player.talkStop') : t('player.talk')"
      :active="talk"
      tone="danger"
      @click="toggleTalk"
    >
      <Mic v-if="talk" />
      <MicOff v-else />
    </OverlayButton>
    <OverlayButton
      v-if="hasAudio"
      size="md"
      :label="muted ? t('player.unmute') : t('player.mute')"
      @click="muted = !muted"
    >
      <VolumeX v-if="muted" />
      <Volume2 v-else />
    </OverlayButton>
    <OverlayButton
      size="md"
      class="live-controls__record"
      :class="{ 'is-recording': recording }"
      :label="recording ? t('player.recordStop') : t('player.recordNow')"
      :active="recording"
      tone="danger"
      @click="emit('toggleRecord')"
    >
      <CircleStop v-if="recording" />
      <CircleDot v-else />
    </OverlayButton>
    <OverlayButton
      size="md"
      :label="t('player.snapshot')"
      :disabled="snapshotBusy"
      @click="emit('snapshot')"
      ><Camera
    /></OverlayButton>
    <LiveSettingsMenu
      v-model:stream="stream"
      v-model:low-bandwidth="lowBandwidth"
      v-model:play-in-background="playInBackground"
      v-model:show-stats="showStats"
      :camera="camera"
      size="md"
    />
  </div>
</template>

<style scoped>
.live-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: auto;
}

.live-controls__record.is-recording {
  animation: record-pulse 1.4s var(--ease) infinite;
}

@keyframes record-pulse {
  50% {
    box-shadow: 0 0 0 4px var(--danger-glow);
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-controls__record.is-recording {
    animation: none;
  }
}
</style>
