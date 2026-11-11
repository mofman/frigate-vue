<script setup lang="ts">
/**
 * Recorded playback bar: volume, skip, play, speed, still and fullscreen in
 * one centred pill, with the jump to live pill beside it.
 */
import {
  Camera,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "@lucide/vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import type { Playback } from "@/composables/usePlayback";
import { useT } from "@/composables/useT";

const props = defineProps<{
  playback: Playback;
  fullscreen: boolean;
  supportsFullscreen: boolean;
  snapshotBusy: boolean;
}>();
const emit = defineEmits<{
  toggleFullscreen: [];
  snapshot: [];
}>();

const muted = defineModel<boolean>("muted", { required: true });
const volume = defineModel<number>("volume", { required: true });

const { t } = useT(["views/app"]);
const RATES = [0.5, 1, 2, 4, 8, 16];

function skip(seconds: number) {
  props.playback.seek(
    props.playback.time.value + seconds,
    props.playback.playing.value,
  );
}

function onVolume(event: Event) {
  volume.value = Number((event.target as HTMLInputElement).value);
  muted.value = volume.value === 0;
}
</script>

<template>
  <div class="playback-bar">
    <div class="playback-bar__pill">
      <div class="playback-bar__volume">
        <button
          type="button"
          class="playback-bar__button"
          :aria-label="muted ? t('player.unmute') : t('player.mute')"
          :title="muted ? t('player.unmute') : t('player.mute')"
          @click="muted = !muted"
        >
          <VolumeX v-if="muted || volume === 0" />
          <Volume2 v-else />
        </button>
        <input
          class="playback-bar__slider"
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="muted ? 0 : volume"
          :aria-label="t('player.volume')"
          :style="{ '--fill': `${(muted ? 0 : volume) * 100}%` }"
          @input="onVolume"
        />
      </div>
      <button
        type="button"
        class="playback-bar__button playback-bar__skip"
        :aria-label="t('player.back10')"
        :title="t('player.back10')"
        @click="skip(-10)"
      >
        <RotateCcw /><span aria-hidden="true">10</span>
      </button>
      <button
        type="button"
        class="playback-bar__button playback-bar__play"
        :aria-label="
          playback.playing.value ? t('player.pause') : t('player.play')
        "
        :title="playback.playing.value ? t('player.pause') : t('player.play')"
        @click="playback.setPlaying(!playback.playing.value)"
      >
        <Pause v-if="playback.playing.value" />
        <Play v-else />
      </button>
      <button
        type="button"
        class="playback-bar__button playback-bar__skip"
        :aria-label="t('player.forward10')"
        :title="t('player.forward10')"
        @click="skip(10)"
      >
        <RotateCw /><span aria-hidden="true">10</span>
      </button>
      <PopoverMenu align="start" width="120px">
        <template #trigger="{ popovertarget }">
          <button
            type="button"
            class="playback-bar__button playback-bar__rate"
            :popovertarget="popovertarget"
            :aria-label="t('player.speed')"
            :title="t('player.speed')"
          >
            {{ playback.rate.value }}x
          </button>
        </template>
        <template #default="{ close }">
          <MenuItem
            v-for="rate in RATES"
            :key="rate"
            :selected="playback.rate.value === rate"
            @click="
              playback.setRate(rate);
              close();
            "
          >
            {{ rate }}x
          </MenuItem>
        </template>
      </PopoverMenu>
      <button
        type="button"
        class="playback-bar__button"
        :aria-label="t('player.snapshot')"
        :title="t('player.snapshot')"
        :disabled="snapshotBusy"
        @click="emit('snapshot')"
      >
        <Camera />
      </button>
      <button
        v-if="supportsFullscreen"
        type="button"
        class="playback-bar__button"
        :aria-label="
          fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')
        "
        :title="
          fullscreen ? t('player.exitFullscreen') : t('player.fullscreen')
        "
        @click="emit('toggleFullscreen')"
      >
        <Minimize2 v-if="fullscreen" />
        <Maximize2 v-else />
      </button>
    </div>
  </div>
</template>

<style scoped>
.playback-bar {
  container: playback-bar / inline-size;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  inline-size: 100%;
}

.playback-bar__pill {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-overlay);
  background: var(--bg-overlay-control);
  backdrop-filter: blur(14px);
  color: var(--text-on-media);
  pointer-events: auto;
}

.playback-bar__button {
  position: relative;
  display: inline-grid;
  place-items: center;
  min-inline-size: 32px;
  block-size: 32px;
  padding-inline: 5px;
  border-radius: var(--radius-xs);
  color: var(--text-on-media-muted);
  transition:
    background var(--dur-fast),
    color var(--dur-fast);

  &:hover:not(:disabled) {
    background: var(--bg-overlay-control-hover);
    color: var(--text-on-media);
  }

  &:disabled {
    opacity: 0.5;
  }
}

.playback-bar__button :deep(svg) {
  inline-size: 16px;
  block-size: 16px;
}

.playback-bar__play :deep(svg) {
  inline-size: 18px;
  block-size: 18px;
}

/* lucide has no numbered skip icon, so draw the 10 inside the arrow */
.playback-bar__skip span {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding-block-start: 1px;
  font-size: 7px;
  font-weight: 700;
}

.playback-bar__rate {
  font-size: var(--text-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.playback-bar__volume {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-inline-end: 6px;
}

.playback-bar__slider {
  inline-size: 80px;
  block-size: 3px;
  appearance: none;
  border-radius: var(--radius-pill);
  background: linear-gradient(
    to right,
    var(--text-on-media) var(--fill),
    var(--line-overlay) var(--fill)
  );
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    inline-size: 12px;
    block-size: 12px;
    border-radius: 50%;
    background: var(--text-on-media);
  }

  &::-moz-range-thumb {
    inline-size: 12px;
    block-size: 12px;
    border: none;
    border-radius: 50%;
    background: var(--text-on-media);
  }
}

@container playback-bar (max-width: 620px) {
  .playback-bar__slider {
    display: none;
  }
}

@container playback-bar (max-width: 440px) {
  .playback-bar__pill {
    gap: 0;
    padding-inline: 4px;
  }

  .playback-bar__button {
    min-inline-size: 32px;
  }
}
</style>
