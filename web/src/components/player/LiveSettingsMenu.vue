<script setup lang="ts">
/** Stream picker and live playback preferences. */
import { computed } from "vue";
import { Check, Settings } from "@lucide/vue";
import OverlayButton from "@/components/ui/OverlayButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import { cameraStreams } from "@/players/streams";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";

const props = defineProps<{ camera: CameraConfig }>();
const stream = defineModel<string | undefined>("stream", { required: true });
const lowBandwidth = defineModel<boolean>("lowBandwidth", { required: true });
const playInBackground = defineModel<boolean>("playInBackground", {
  required: true,
});

const { t } = useT(["views/app"]);
const streams = computed(() => cameraStreams(props.camera));
const current = computed(() => stream.value ?? streams.value[0]?.[1]);
</script>

<template>
  <PopoverMenu align="end" width="250px">
    <template #trigger="{ popovertarget }">
      <OverlayButton
        :label="t('player.settings')"
        :popovertarget="popovertarget"
        ><Settings
      /></OverlayButton>
    </template>
    <template v-if="streams.length > 1">
      <MenuLabel>{{ t("player.stream") }}</MenuLabel>
      <MenuItem
        v-for="[label, name] in streams"
        :key="name"
        :selected="current === name"
        @click="stream = name"
      >
        {{ label }}
        <template v-if="current === name" #hint><Check :size="14" /></template>
      </MenuItem>
    </template>
    <MenuLabel>{{ t("player.playback") }}</MenuLabel>
    <ToggleSwitch v-model="lowBandwidth" :label="t('player.lowBandwidth')" />
    <ToggleSwitch
      v-model="playInBackground"
      :label="t('player.playInBackground')"
    />
  </PopoverMenu>
</template>
