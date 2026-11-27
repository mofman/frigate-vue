<script setup lang="ts">
/** Summary of what was configured, then the restart when one is needed. */
import { computed, shallowRef } from "vue";
import { CircleCheck } from "@lucide/vue";
import { http } from "@/api/http";
import { useRestart } from "@/composables/useRestart";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import { dismissSetup } from "@/utils/setupWizard";
import SetupNote from "./SetupNote.vue";
import SetupRow from "./SetupRow.vue";
import SetupStep from "./SetupStep.vue";

export type ConfiguredSteps = {
  hwaccel: boolean;
  detector: boolean;
  recording: boolean;
};

const props = defineProps<{
  cameras: string[];
  configured: ConfiguredSteps;
  restartRequired: boolean;
}>();
defineEmits<{ back: [] }>();

const { t } = useT(["views/setup"]);
const { reload, restartStarted } = useRestart();
const finishing = shallowRef(false);

const items = computed(() => {
  const done = (value: boolean) =>
    value ? t("setupWizard.complete.configured") : undefined;
  const label = t("setupWizard.complete.camera");
  return [
    ...(props.cameras.length
      ? props.cameras.map((name) => ({
          key: `camera-${name}`,
          label,
          value: name,
        }))
      : [{ key: "camera", label, value: undefined }]),
    {
      key: "hwaccel",
      label: t("setupWizard.complete.hwaccel"),
      value: done(props.configured.hwaccel),
    },
    {
      key: "detector",
      label: t("setupWizard.complete.detector"),
      value: done(props.configured.detector),
    },
    {
      key: "recording",
      label: t("setupWizard.complete.recording"),
      value: done(props.configured.recording),
    },
  ];
});

async function finish() {
  finishing.value = true;
  dismissSetup();
  // camera adds apply live, so they alone never need the restart
  if (!props.restartRequired) {
    reload();
    return;
  }
  try {
    await http.post("restart");
    restartStarted();
  } catch {
    finishing.value = false;
    showToast(t("setupWizard.errors.saveFailed"), "error");
  }
}
</script>

<template>
  <SetupStep
    :title="t('setupWizard.complete.title')"
    :description="t('setupWizard.complete.description')"
    :next-label="
      restartRequired
        ? t('setupWizard.complete.applyAndRestart')
        : t('setupWizard.complete.goToLiveView')
    "
    :next-disabled="finishing"
    @back="$emit('back')"
    @next="finish"
  >
    <div class="setup-complete__items">
      <SetupRow v-for="item in items" :key="item.key" :label="item.label">
        <CircleCheck v-if="item.value" class="is-ok" :size="16" />
        {{ item.value ?? t("setupWizard.complete.notConfigured") }}
      </SetupRow>
    </div>
    <p class="setup-complete__next">
      {{ t("setupWizard.complete.nextSteps") }}
    </p>
    <SetupNote v-if="restartRequired">
      {{ t("setupWizard.complete.restartNotice") }}
    </SetupNote>
  </SetupStep>
</template>

<style scoped>
.setup-complete__items {
  display: grid;
  gap: 8px;
}

.setup-complete__next {
  font-size: var(--text-md);
  color: var(--text-secondary);
}
</style>
