<script setup lang="ts">
/**
 * Per tile menu, opened from the "more" button or a right click on the
 * tile: camera power, tile audio, stream stats and notification snoozing.
 */
import { computed, shallowRef } from "vue";
import {
  BellOff,
  BellRing,
  Ellipsis,
  Expand,
  Gauge,
  Power,
  Volume2,
  VolumeX,
} from "@lucide/vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";
import OverlayButton from "@/components/ui/OverlayButton.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import { sendWs, useWsTopic } from "@/api/ws";
import { useFeatureState } from "@/composables/useCameraActivity";
import { useIsAdmin } from "@/composables/useFrigate";
import { useNow } from "@/composables/useUtil";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";

const props = defineProps<{
  camera: CameraConfig;
  hasAudio: boolean;
  muted: boolean;
  stats: boolean;
}>();
const emit = defineEmits<{
  "update:muted": [value: boolean];
  "update:stats": [value: boolean];
  muteAll: [muted: boolean];
  open: [];
}>();

const { t } = useT(["views/app"]);
const isAdmin = useIsAdmin();
const now = useNow(30_000);
const menu = shallowRef<InstanceType<typeof PopoverMenu> | null>(null);

const name = () => props.camera.name;
const enabled = useFeatureState(name, "enabled");
const notifications = useFeatureState(name, "notifications");
const suspendedUntil = useWsTopic<number | string>(
  () => `${props.camera.name}/notifications/suspended`,
);

const cameraOn = computed(() => !enabled.known.value || enabled.on.value);
const showNotifications = computed(
  () => !!props.camera.notifications?.enabled_in_config && cameraOn.value,
);
const suspended = computed(() => Number(suspendedUntil.value ?? 0) > now.value);

const SNOOZE = [5, 10, 30, 60, 720, 1440];

function snooze(minutes: number) {
  sendWs(`${props.camera.name}/notifications/suspend`, minutes);
}

function enableNotifications() {
  sendWs(`${props.camera.name}/notifications/set`, "ON");
  sendWs(`${props.camera.name}/notifications/suspend`, 0);
}

function snoozeLabel(minutes: number) {
  return minutes < 60
    ? t("tile.minutes", { count: minutes })
    : t("tile.hours", { count: minutes / 60 });
}

defineExpose({
  openAt: (x: number, y: number) => menu.value?.openAt(x, y),
});
</script>

<template>
  <!-- the menu lives inside the clickable tile, keep its clicks to itself -->
  <div class="tile-menu" @click.stop @keydown.enter.stop @contextmenu.stop>
    <PopoverMenu ref="menu" align="end" width="240px">
      <template #trigger="{ popovertarget }">
        <OverlayButton :label="t('tile.more')" :popovertarget="popovertarget">
          <Ellipsis />
        </OverlayButton>
      </template>
      <template #default="{ close }">
        <MenuItem
          @click="
            emit('open');
            close();
          "
        >
          <template #icon><Expand /></template>
          {{ t("dashboard.expand") }}
        </MenuItem>
        <MenuItem
          v-if="isAdmin"
          @click="
            enabled.set(!cameraOn);
            close();
          "
        >
          <template #icon><Power /></template>
          {{ cameraOn ? t("tile.disable") : t("tile.enable") }}
        </MenuItem>
        <MenuLabel>{{ t("tile.audio") }}</MenuLabel>
        <MenuItem
          v-if="hasAudio"
          :disabled="!cameraOn"
          @click="
            emit('update:muted', !muted);
            close();
          "
        >
          <template #icon><VolumeX v-if="!muted" /><Volume2 v-else /></template>
          {{ muted ? t("tile.unmute") : t("tile.mute") }}
        </MenuItem>
        <MenuItem
          @click="
            emit('muteAll', true);
            close();
          "
        >
          <template #icon><VolumeX /></template>
          {{ t("tile.muteAll") }}
        </MenuItem>
        <MenuItem
          @click="
            emit('muteAll', false);
            close();
          "
        >
          <template #icon><Volume2 /></template>
          {{ t("tile.unmuteAll") }}
        </MenuItem>
        <MenuItem
          :disabled="!cameraOn"
          @click="
            emit('update:stats', !stats);
            close();
          "
        >
          <template #icon><Gauge /></template>
          {{ stats ? t("tile.hideStats") : t("tile.showStats") }}
        </MenuItem>
        <template v-if="showNotifications">
          <MenuLabel>{{ t("tile.notifications") }}</MenuLabel>
          <MenuItem
            v-if="!notifications.on.value || suspended"
            @click="
              enableNotifications();
              close();
            "
          >
            <template #icon><BellRing /></template>
            {{
              suspended ? t("tile.unsuspend") : t("tile.enableNotifications")
            }}
          </MenuItem>
          <template v-else>
            <MenuItem
              v-for="minutes in SNOOZE"
              :key="minutes"
              @click="
                snooze(minutes);
                close();
              "
            >
              <template #icon><BellOff /></template>
              {{ t("tile.suspendFor", { time: snoozeLabel(minutes) }) }}
            </MenuItem>
            <MenuItem
              @click="
                notifications.set(false);
                close();
              "
            >
              <template #icon><BellOff /></template>
              {{ t("tile.suspendUntilRestart") }}
            </MenuItem>
          </template>
        </template>
      </template>
    </PopoverMenu>
  </div>
</template>

<style scoped>
.tile-menu {
  display: contents;
}
</style>
