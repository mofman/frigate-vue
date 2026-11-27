<script setup lang="ts">
/** Add Camera wizard: connect, find streams, assign roles, validate and save. */
import { computed, shallowRef, watch } from "vue";
import { errorMessage, http } from "@/api/http";
import { invalidate } from "@/api/query";
import AppDialog from "@/components/ui/AppDialog.vue";
import StepIndicator from "@/components/ui/StepIndicator.vue";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import type { WizardData } from "@/types/cameraWizard";
import {
  buildCameraConfig,
  buildGo2rtcStreams,
  canLeaveStep,
} from "@/utils/cameraWizard";
import StepNameCamera from "./StepNameCamera.vue";
import StepProbeOrSnapshot from "./StepProbeOrSnapshot.vue";
import StepStreamConfig from "./StepStreamConfig.vue";
import StepValidation from "./StepValidation.vue";

const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{
  /** fired once the camera's config write has succeeded */
  cameraAdded: [camera: { name: string; detectCodec?: string }];
}>();

const { t } = useT(["views/settings", "common"]);
const step = shallowRef(0);
const data = shallowRef<WizardData>({ streams: [] });
const saving = shallowRef(false);

const stepLabels = computed(() => [
  t("cameraWizard.steps.nameAndConnection"),
  t("cameraWizard.steps.probeOrSnapshot"),
  t("cameraWizard.steps.streamConfiguration"),
  t("cameraWizard.steps.validationAndTesting"),
]);

watch(open, (value) => {
  if (!value) return;
  step.value = 0;
  data.value = { streams: [] };
});

function update(patch: Partial<WizardData>) {
  data.value = { ...data.value, ...patch };
}

function next(patch?: Partial<WizardData>) {
  if (patch) update(patch);
  if (canLeaveStep(step.value, data.value)) step.value++;
}

async function saveGo2rtc(camera: string, hasBackchannel: boolean) {
  const streams = buildGo2rtcStreams(
    camera,
    data.value.streams,
    hasBackchannel,
  );
  await http.put("config/set", {
    requires_restart: 0,
    config_data: { go2rtc: { streams } },
  });
  // also update the running go2rtc instance for immediate effect
  await Promise.allSettled(
    Object.entries(streams).map(([name, sources]) =>
      http.put(`go2rtc/streams/${encodeURIComponent(name)}`, undefined, {
        params: { src: sources[0] },
      }),
    ),
  );
}

async function save(hasBackchannel: boolean) {
  const { name, friendlyName, body } = buildCameraConfig(data.value);
  const cameraName = friendlyName ?? name;
  saving.value = true;
  try {
    await http.put("config/set", body);
  } catch (error) {
    showToast(
      t("common:toast.save.error.title", {
        errorMessage: errorMessage(error),
      }),
      "error",
      6000,
    );
    saving.value = false;
    return;
  }

  emit("cameraAdded", {
    name,
    detectCodec: data.value.streams.find((stream) =>
      stream.roles.includes("detect"),
    )?.testResult?.videoCodec,
  });

  try {
    await saveGo2rtc(name, hasBackchannel);
    showToast(t("cameraWizard.save.success", { cameraName }), "success");
  } catch {
    // the camera itself is saved, only restreaming needs attention
    showToast(t("cameraWizard.save.failure", { cameraName }), "error", 6000);
  }
  saving.value = false;
  invalidate("config");
  open.value = false;
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="t('cameraWizard.title')"
    width="720px"
    persistent
  >
    <template v-if="open">
      <StepIndicator :steps="stepLabels" :current="step" />
      <p v-if="step === 0" class="camera-wizard__text">
        {{ t("cameraWizard.description") }}
      </p>
      <p v-else class="camera-wizard__text">{{ data.cameraName }}</p>
      <StepNameCamera
        v-if="step === 0"
        :data="data"
        @cancel="open = false"
        @next="next"
      />
      <StepProbeOrSnapshot
        v-else-if="step === 1"
        :data="data"
        @back="step--"
        @update="update"
        @next="next"
      />
      <StepStreamConfig
        v-else-if="step === 2"
        :data="data"
        @back="step--"
        @update="update"
        @next="next()"
      />
      <StepValidation
        v-else
        :data="data"
        :saving="saving"
        @back="step--"
        @update="update"
        @save="save"
      />
    </template>
  </AppDialog>
</template>

<style scoped>
.camera-wizard__text {
  font-size: var(--text-md);
  color: var(--text-secondary);
}
</style>
