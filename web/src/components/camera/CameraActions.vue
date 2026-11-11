<script setup lang="ts">
/** Actions menu for the camera view: export a clip, share this moment. */
import { shallowRef } from "vue";
import { Clapperboard, Download, Share2 } from "@lucide/vue";
import IconButton from "@/components/ui/IconButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import { baseUrl } from "@/api/baseUrl";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";
import ExportDialog from "./ExportDialog.vue";

const props = defineProps<{
  camera: string;
  time: number;
  live: boolean;
  showLabel?: boolean;
}>();
const { t } = useT(["views/app"]);
const exporting = shallowRef(false);

function shareUrl() {
  const time = Math.floor(props.live ? Date.now() / 1000 : props.time);
  return new URL(
    `camera/${encodeURIComponent(props.camera)}?t=${time}`,
    new URL(baseUrl, window.location.origin),
  ).href;
}

async function share() {
  const url = shareUrl();
  try {
    await navigator.clipboard.writeText(url);
    showToast(t("toolbar.linkCopied"), "success");
  } catch {
    // no clipboard (insecure context), show the link so it can be copied
    window.prompt(t("toolbar.copyLink"), url);
  }
}
</script>

<template>
  <PopoverMenu align="end" width="220px">
    <template #trigger="{ popovertarget }">
      <IconButton
        :label="t('toolbar.actions')"
        :show-label="showLabel"
        :popovertarget="popovertarget"
      >
        <Clapperboard />
      </IconButton>
    </template>
    <template #default="{ close }">
      <MenuItem
        @click="
          exporting = true;
          close();
        "
      >
        <template #icon><Download /></template>
        {{ t("toolbar.export") }}
      </MenuItem>
      <MenuItem
        @click="
          share();
          close();
        "
      >
        <template #icon><Share2 /></template>
        {{ t("toolbar.share") }}
      </MenuItem>
    </template>
  </PopoverMenu>
  <ExportDialog v-model:open="exporting" :camera="camera" :time="time" />
</template>
