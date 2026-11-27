<script setup lang="ts">
/** Adds cameras through the Add Camera wizard. */
import { shallowRef } from "vue";
import { CircleCheck } from "@lucide/vue";
import CameraWizardDialog from "@/components/camera-wizard/CameraWizardDialog.vue";
import AppButton from "@/components/ui/AppButton.vue";
import { useT } from "@/composables/useT";
import SetupRow from "./SetupRow.vue";
import SetupStep from "./SetupStep.vue";

const emit = defineEmits<{
  back: [];
  next: [cameras: string[], detectCodecs: Record<string, string>];
}>();

const { t } = useT(["views/setup"]);
const wizardOpen = shallowRef(false);
const cameras = shallowRef<string[]>([]);
const detectCodecs = shallowRef<Record<string, string>>({});

function added(camera: { name: string; detectCodec?: string }) {
  if (!cameras.value.includes(camera.name)) {
    cameras.value = [...cameras.value, camera.name];
  }
  if (camera.detectCodec) {
    detectCodecs.value = {
      ...detectCodecs.value,
      [camera.name]: camera.detectCodec,
    };
  }
}
</script>

<template>
  <SetupStep
    :title="t('setupWizard.camera.title')"
    :description="t('setupWizard.camera.description')"
    :next-label="cameras.length ? undefined : t('setupWizard.actions.skip')"
    @back="$emit('back')"
    @next="emit('next', cameras, detectCodecs)"
  >
    <div v-if="cameras.length" class="setup-camera__list">
      <SetupRow v-for="camera in cameras" :key="camera" :label="camera">
        <CircleCheck
          class="is-ok"
          :size="16"
          :aria-label="t('setupWizard.camera.cameraAdded')"
        />
      </SetupRow>
    </div>
    <AppButton @click="wizardOpen = true">
      {{
        cameras.length
          ? t("setupWizard.camera.addAnother")
          : t("setupWizard.camera.addCamera")
      }}
    </AppButton>
    <CameraWizardDialog v-model:open="wizardOpen" @camera-added="added" />
  </SetupStep>
</template>

<style scoped>
.setup-camera__list {
  display: grid;
  gap: 8px;
}
</style>
