<script setup lang="ts">
/**
 * Links to the admin pages plus restart, shared by the rail's settings menu
 * and the account menu. Emits `done` so the host menu can close.
 */
import { useRouter } from "vue-router";
import { Activity, FileCode, RotateCcw, ScrollText } from "@lucide/vue";
import { useRestart } from "@/composables/useRestart";
import { useT } from "@/composables/useT";
import MenuItem from "@/components/ui/MenuItem.vue";
import MenuLabel from "@/components/ui/MenuLabel.vue";

const emit = defineEmits<{ done: [] }>();
const { t } = useT(["common"]);
const router = useRouter();
const { requestRestart } = useRestart();

function go(path: string) {
  emit("done");
  void router.push(path);
}

function restart() {
  emit("done");
  requestRestart();
}
</script>

<template>
  <MenuLabel>{{ t("menu.system") }}</MenuLabel>
  <MenuItem role="menuitem" @click="go('/system')">
    <template #icon><Activity /></template>
    {{ t("menu.systemMetrics") }}
  </MenuItem>
  <MenuItem role="menuitem" @click="go('/logs')">
    <template #icon><ScrollText /></template>
    {{ t("menu.systemLogs") }}
  </MenuItem>
  <MenuLabel>{{ t("menu.configuration") }}</MenuLabel>
  <MenuItem role="menuitem" @click="go('/config')">
    <template #icon><FileCode /></template>
    {{ t("menu.configurationEditor") }}
  </MenuItem>
  <MenuItem role="menuitem" @click="restart">
    <template #icon><RotateCcw /></template>
    {{ t("menu.restart") }}
  </MenuItem>
</template>
