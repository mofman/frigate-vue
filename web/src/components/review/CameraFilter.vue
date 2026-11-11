<script setup lang="ts">
/** Multi-select of cameras as a popover menu. Empty selection means all. */
import { computed } from "vue";
import { Check, Video } from "@lucide/vue";
import { cameraLabel } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type { CameraConfig } from "@/types/frigate";
import IconButton from "@/components/ui/IconButton.vue";
import MenuItem from "@/components/ui/MenuItem.vue";
import PopoverMenu from "@/components/ui/PopoverMenu.vue";

const props = defineProps<{ cameras: CameraConfig[] }>();
const model = defineModel<string[]>({ required: true });
const { t } = useT(["views/app", "views/events"]);

const summary = computed(() => {
  if (!model.value.length) return t("views/events:allCameras");
  if (model.value.length === 1) {
    return cameraLabel(
      props.cameras.find((camera) => camera.name === model.value[0]),
      model.value[0],
    );
  }
  return t("review.camerasSelected", { count: model.value.length });
});

function toggle(name: string) {
  model.value = model.value.includes(name)
    ? model.value.filter((camera) => camera !== name)
    : [...model.value, name];
}
</script>

<template>
  <PopoverMenu align="end" width="240px">
    <template #trigger="{ popovertarget }">
      <IconButton
        :label="summary"
        show-label
        :active="model.length > 0"
        :popovertarget="popovertarget"
      >
        <Video />
      </IconButton>
    </template>
    <MenuItem :selected="!model.length" @click="model = []">
      {{ t("views/events:allCameras") }}
      <template v-if="!model.length" #hint><Check :size="14" /></template>
    </MenuItem>
    <MenuItem
      v-for="camera in cameras"
      :key="camera.name"
      :selected="model.includes(camera.name)"
      @click="toggle(camera.name)"
    >
      {{ cameraLabel(camera) }}
      <template v-if="model.includes(camera.name)" #hint
        ><Check :size="14"
      /></template>
    </MenuItem>
  </PopoverMenu>
</template>
