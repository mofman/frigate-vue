<script setup lang="ts">
/** Chooses whether and how long video is kept. */
import { computed, shallowRef } from "vue";
import { http } from "@/api/http";
import RadioOption from "@/components/ui/RadioOption.vue";
import TextField from "@/components/ui/TextField.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import { useStats } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import {
  clampRetentionDays,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  RECORDINGS_PATH,
  recordingConfig,
  recordingStorageEstimate,
  type RecordingMode,
} from "@/utils/setupConfig";
import SetupNote from "./SetupNote.vue";
import SetupStep from "./SetupStep.vue";

const MODES: RecordingMode[] = ["events", "continuous"];

const props = defineProps<{ cameraCount: number }>();
const emit = defineEmits<{ back: []; skip: []; next: [] }>();

const { t } = useT(["views/setup"]);
const stats = useStats();
const enabled = shallowRef(true);
const mode = shallowRef<string>("events");
const retention = shallowRef("10");
const saving = shallowRef(false);

const estimate = computed(() => {
  const free = stats.value?.service.storage[RECORDINGS_PATH]?.free;
  return free === undefined
    ? null
    : recordingStorageEstimate(free, props.cameraCount);
});

async function save() {
  saving.value = true;
  try {
    await http.put("config/set", {
      config_data: recordingConfig(
        enabled.value,
        mode.value as RecordingMode,
        clampRetentionDays(retention.value),
      ),
      requires_restart: 1,
    });
    emit("next");
  } catch {
    showToast(t("setupWizard.errors.saveFailed"), "error");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <SetupStep
    :title="t('setupWizard.recording.title')"
    :description="t('setupWizard.recording.description')"
    can-skip
    :busy="saving"
    @back="$emit('back')"
    @skip="$emit('skip')"
    @next="save"
  >
    <SetupNote v-if="cameraCount === 0">
      {{ t("setupWizard.recording.noCameras") }}
    </SetupNote>
    <ToggleSwitch
      v-model="enabled"
      class="setup-recording__toggle"
      :label="t('setupWizard.recording.enableRecording')"
    />
    <template v-if="enabled">
      <fieldset class="setup-recording__modes">
        <legend>{{ t("setupWizard.recording.modeLabel") }}</legend>
        <RadioOption
          v-for="option in MODES"
          :key="option"
          v-model="mode"
          name="setup-recording-mode"
          :value="option"
          :label="t(`setupWizard.recording.modes.${option}.label`)"
          :description="t(`setupWizard.recording.modes.${option}.description`)"
        />
      </fieldset>
      <TextField
        v-model="retention"
        type="number"
        :min="MIN_RETENTION_DAYS"
        :max="MAX_RETENTION_DAYS"
        :label="t('setupWizard.recording.retentionDays')"
        :hint="t(`setupWizard.recording.retentionHint.${mode}`)"
      />
      <SetupNote v-if="mode === 'continuous' && estimate">
        {{
          t("setupWizard.recording.storageEstimate", {
            free: estimate.free,
            days: estimate.days,
            cameras: cameraCount,
          })
        }}
      </SetupNote>
    </template>
  </SetupStep>
</template>

<style scoped>
.setup-recording__toggle {
  border: 1px solid var(--glass-border);
}

.setup-recording__modes {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;

  legend {
    margin-block-end: 6px;
    padding: 0;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-secondary);
  }
}
</style>
