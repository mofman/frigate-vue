<script setup lang="ts">
/**
 * Stage settings: camera feature switches (admins only), stream choice and
 * playback preferences.
 */
import { computed } from "vue";
import { Check, Settings } from "@lucide/vue";
import OverlayButton from "@/components/ui/OverlayButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import { cameraStreams } from "@/players/streams";
import {
  useFeatureState,
  type CameraFeature,
} from "@/composables/useCameraActivity";
import { useIsAdmin } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";

const props = defineProps<{ camera: CameraConfig; size?: "sm" | "md" }>();
const stream = defineModel<string | undefined>("stream", { required: true });
const lowBandwidth = defineModel<boolean>("lowBandwidth", { required: true });
const playInBackground = defineModel<boolean>("playInBackground", {
  required: true,
});
const showStats = defineModel<boolean>("showStats", { required: true });

const { t } = useT(["views/app"]);
const isAdmin = useIsAdmin();
const streams = computed(() => cameraStreams(props.camera));
const current = computed(() => stream.value ?? streams.value[0]?.[1]);

const name = () => props.camera.name;
const enabled = useFeatureState(name, "enabled");
const states: Record<
  Exclude<CameraFeature, "notifications">,
  ReturnType<typeof useFeatureState>
> = {
  enabled,
  detect: useFeatureState(name, "detect"),
  recordings: useFeatureState(name, "recordings"),
  snapshots: useFeatureState(name, "snapshots"),
  audio: useFeatureState(name, "audio"),
  audio_transcription: useFeatureState(name, "audio_transcription"),
  ptz_autotracker: useFeatureState(name, "ptz_autotracker"),
};

type Row = {
  feature: Exclude<CameraFeature, "notifications">;
  label: string;
  disabled: boolean;
};

const rows = computed<Row[]>(() => {
  const camera = props.camera;
  const off = !enabled.on.value && enabled.known.value;
  const list: Row[] = [
    { feature: "enabled", label: t("features.camera"), disabled: false },
    { feature: "detect", label: t("features.detect"), disabled: off },
    {
      feature: "recordings",
      label: t("features.record"),
      disabled: off || !camera.record.enabled_in_config,
    },
    { feature: "snapshots", label: t("features.snapshots"), disabled: off },
  ];
  if (camera.audio.enabled_in_config) {
    list.push({
      feature: "audio",
      label: t("features.audio"),
      disabled: off,
    });
    if (camera.audio_transcription?.enabled_in_config) {
      list.push({
        feature: "audio_transcription",
        label: t("features.transcription"),
        disabled: off || !states.audio.on.value,
      });
    }
  }
  if (camera.onvif?.autotracking?.enabled_in_config) {
    list.push({
      feature: "ptz_autotracker",
      label: t("features.autotracking"),
      disabled: off,
    });
  }
  return list;
});
</script>

<template>
  <PopoverMenu align="end" width="260px">
    <template #trigger="{ popovertarget }">
      <OverlayButton
        :size="size"
        :label="t('player.settings')"
        :popovertarget="popovertarget"
        ><Settings
      /></OverlayButton>
    </template>
    <template v-if="isAdmin">
      <MenuLabel>{{ t("features.title") }}</MenuLabel>
      <ToggleSwitch
        v-for="row in rows"
        :key="row.feature"
        :model-value="states[row.feature].on.value"
        :label="row.label"
        :disabled="row.disabled"
        @update:model-value="states[row.feature].set($event)"
      />
    </template>
    <template v-if="streams.length > 1">
      <MenuLabel>{{ t("player.stream") }}</MenuLabel>
      <MenuItem
        v-for="[label, streamName] in streams"
        :key="streamName"
        :selected="current === streamName"
        @click="stream = streamName"
      >
        {{ label }}
        <template v-if="current === streamName" #hint
          ><Check :size="14"
        /></template>
      </MenuItem>
    </template>
    <MenuLabel>{{ t("player.playback") }}</MenuLabel>
    <ToggleSwitch v-model="lowBandwidth" :label="t('player.lowBandwidth')" />
    <ToggleSwitch
      v-model="playInBackground"
      :label="t('player.playInBackground')"
    />
    <ToggleSwitch v-model="showStats" :label="t('player.showStats')" />
  </PopoverMenu>
</template>
