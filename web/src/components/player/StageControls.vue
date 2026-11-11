<script setup lang="ts">
/** Controls along the bottom of the stage, switching set by mode. */
import { computed } from "vue";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  Rewind,
  FastForward,
  Volume2,
  VolumeX,
} from "@lucide/vue";
import OverlayButton from "@/components/ui/OverlayButton.vue";
import type { Playback } from "@/composables/usePlayback";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";
import FeatureToggles from "./FeatureToggles.vue";
import LiveSettingsMenu from "./LiveSettingsMenu.vue";

const props = defineProps<{
  camera: CameraConfig;
  playback: Playback;
  fullscreen: boolean;
  supportsFullscreen: boolean;
}>();
const emit = defineEmits<{ toggleFullscreen: [] }>();

const muted = defineModel<boolean>("muted", { required: true });
const stream = defineModel<string | undefined>("stream", { required: true });
const lowBandwidth = defineModel<boolean>("lowBandwidth", { required: true });
const playInBackground = defineModel<boolean>("playInBackground", {
  required: true,
});

const { t } = useT(["views/app"]);
const live = computed(() => props.playback.isLive.value);

function skip(seconds: number) {
  props.playback.seek(
    props.playback.time.value + seconds,
    props.playback.playing.value,
  );
}
</script>

<template>
  <div class="stage-controls">
    <div class="stage-controls__group">
      <template v-if="!live">
        <OverlayButton :label="t('player.back10')" @click="skip(-10)"
          ><Rewind
        /></OverlayButton>
        <OverlayButton
          :label="playback.playing.value ? t('player.pause') : t('player.play')"
          @click="playback.setPlaying(!playback.playing.value)"
        >
          <Pause v-if="playback.playing.value" />
          <Play v-else />
        </OverlayButton>
        <OverlayButton :label="t('player.forward10')" @click="skip(10)"
          ><FastForward
        /></OverlayButton>
        <button
          type="button"
          class="stage-controls__live"
          @click="playback.goLive()"
        >
          <Radio :size="14" aria-hidden="true" />
          {{ t("player.jumpToLive") }}
        </button>
      </template>
      <FeatureToggles v-else :camera="camera.name" />
    </div>
    <div class="stage-controls__group">
      <OverlayButton
        :label="muted ? t('player.unmute') : t('player.mute')"
        @click="muted = !muted"
      >
        <VolumeX v-if="muted" />
        <Volume2 v-else />
      </OverlayButton>
      <LiveSettingsMenu
        v-model:stream="stream"
        v-model:low-bandwidth="lowBandwidth"
        v-model:play-in-background="playInBackground"
        :camera="camera"
      />
      <OverlayButton
        v-if="supportsFullscreen"
        :label="
          fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')
        "
        @click="emit('toggleFullscreen')"
      >
        <Minimize2 v-if="fullscreen" />
        <Maximize2 v-else />
      </OverlayButton>
    </div>
  </div>
</template>

<style scoped>
.stage-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  inline-size: 100%;
}

.stage-controls__group {
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
}

.stage-controls__live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  block-size: 30px;
  padding-inline: 10px;
  border-radius: var(--radius-xs);
  background: var(--live);
  color: var(--live-ink);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  box-shadow: 0 0 18px var(--live-glow);
  transition: filter var(--dur-fast);

  &:hover {
    filter: brightness(1.08);
  }
}
</style>
