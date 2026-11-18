<script setup lang="ts">
/** Actions for one tracked object, on its card and in its details. */
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Ellipsis } from "@lucide/vue";
import { apiBase } from "@/api/http";
import IconButton from "@/components/ui/IconButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";
import { useConfig, useIsAdmin } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { TrackedEvent } from "@/types/event";
import {
  downloadFile,
  eventCleanSnapshot,
  eventClip,
  eventSnapshot,
} from "@/utils/explore";
import { REVIEW_PADDING } from "@/utils/review";

const props = defineProps<{
  event: TrackedEvent;
  /** inside the details dialog, which already shows tracking and delete */
  detail?: boolean;
}>();
const emit = defineEmits<{
  trackingDetails: [];
  findSimilar: [];
  delete: [];
}>();

const { t } = useT(["views/explore", "common"]);
const router = useRouter();
const admin = useIsAdmin();
const { data: config } = useConfig();

const isObject = computed(() => props.event.data.type === "object");
const canFindSimilar = computed(
  () => !!config.value?.semantic_search?.enabled && isObject.value,
);
const baseName = computed(() => `${props.event.camera}_${props.event.label}`);

function downloadVideo() {
  const { event } = props;
  if (!props.detail) {
    downloadFile(eventClip(event), `${baseName.value}.mp4`);
    return;
  }
  const start = event.start_time - REVIEW_PADDING;
  const end = (event.end_time ?? Date.now() / 1000) + REVIEW_PADDING;
  downloadFile(
    `${apiBase}${event.camera}/start/${start}/end/${end}/clip.mp4`,
    `${baseName.value}.mp4`,
  );
}

function viewInHistory() {
  void router.push({
    name: "camera",
    params: { name: props.event.camera },
    query: { t: Math.floor(props.event.start_time - REVIEW_PADDING) },
  });
}
</script>

<template>
  <PopoverMenu align="end" width="230px">
    <template #trigger="{ popovertarget }">
      <IconButton
        class="result-menu__trigger"
        size="sm"
        :label="t('itemMenu.more.aria')"
        :popovertarget="popovertarget"
      >
        <Ellipsis />
      </IconButton>
    </template>
    <template #default="{ close }">
      <div role="menu" @click="close()">
        <MenuItem v-if="event.has_clip" role="menuitem" @click="downloadVideo">
          {{ t("itemMenu.downloadVideo.label") }}
        </MenuItem>
        <template v-if="event.has_snapshot">
          <MenuItem
            role="menuitem"
            @click="downloadFile(eventSnapshot(event), `${baseName}.jpg`)"
          >
            {{ t("itemMenu.downloadSnapshot.label") }}
          </MenuItem>
          <MenuItem
            role="menuitem"
            @click="
              downloadFile(eventCleanSnapshot(event), `${baseName}-clean.webp`)
            "
          >
            {{ t("itemMenu.downloadCleanSnapshot.label") }}
          </MenuItem>
        </template>
        <MenuItem
          v-if="!detail && isObject && event.has_clip"
          role="menuitem"
          @click="emit('trackingDetails')"
        >
          {{ t("itemMenu.viewTrackingDetails.label") }}
        </MenuItem>
        <MenuItem
          v-if="canFindSimilar"
          role="menuitem"
          @click="emit('findSimilar')"
        >
          {{ t("itemMenu.findSimilar.label") }}
        </MenuItem>
        <MenuItem
          v-if="detail && event.has_clip"
          role="menuitem"
          @click="viewInHistory"
        >
          {{ t("itemMenu.viewInHistory.label") }}
        </MenuItem>
        <MenuItem v-if="admin" role="menuitem" @click="emit('delete')">
          {{ t("common:button.delete") }}
        </MenuItem>
      </div>
    </template>
  </PopoverMenu>
</template>

<style scoped>
.result-menu__trigger {
  color: var(--text-on-media);
}
</style>
