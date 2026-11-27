<script setup lang="ts">
/** First run wizard: account, cameras, detection, decoding and recording. */
import { computed, reactive, shallowRef } from "vue";
import SetupAccount from "@/components/setup/SetupAccount.vue";
import SetupCamera from "@/components/setup/SetupCamera.vue";
import SetupComplete, {
  type ConfiguredSteps,
} from "@/components/setup/SetupComplete.vue";
import SetupDetector from "@/components/setup/SetupDetector.vue";
import SetupHwAccel from "@/components/setup/SetupHwAccel.vue";
import SetupRecording from "@/components/setup/SetupRecording.vue";
import SetupWelcome from "@/components/setup/SetupWelcome.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import StepIndicator from "@/components/ui/StepIndicator.vue";
import { useConfig } from "@/composables/useFrigate";
import { useRestart } from "@/composables/useRestart";
import { useT } from "@/composables/useT";
import { dismissSetup } from "@/utils/setupWizard";

const STEP_KEYS = [
  "welcome",
  "account",
  "camera",
  "detector",
  "hwaccel",
  "recording",
  "complete",
] as const;

const { t } = useT(["views/setup"]);
const { data: config, isLoading } = useConfig();
const { reload } = useRestart();

// with native auth off there are no users to manage
const steps = computed(() =>
  config.value?.auth?.enabled === false
    ? STEP_KEYS.filter((key) => key !== "account")
    : [...STEP_KEYS],
);
const stepLabels = computed(() =>
  steps.value.map((key) => t(`setupWizard.steps.${key}`)),
);

const index = shallowRef(0);
const step = computed(() => steps.value[index.value]);
const cameras = shallowRef<string[]>([]);
const detectCodecs = shallowRef<Record<string, string>>({});
const detectorHardwareKey = shallowRef<string>();
const restartRequired = shallowRef(false);
const configured = reactive<ConfiguredSteps>({
  hwaccel: false,
  detector: false,
  recording: false,
});

const next = () => index.value++;
const back = () => (index.value = Math.max(0, index.value - 1));

function skipSetup() {
  dismissSetup();
  reload();
}

function camerasDone(names: string[], codecs: Record<string, string>) {
  cameras.value = names;
  detectCodecs.value = codecs;
  next();
}

function detectorDone(hardwareKey?: string, saved = false) {
  detectorHardwareKey.value = hardwareKey ?? detectorHardwareKey.value;
  configured.detector ||= saved;
  restartRequired.value ||= saved;
  next();
}

function hwaccelDone(saved: boolean) {
  configured.hwaccel = true;
  restartRequired.value ||= saved;
  next();
}

function recordingDone() {
  configured.recording = true;
  restartRequired.value = true;
  next();
}
</script>

<template>
  <div class="setup">
    <main class="setup__card">
      <LoadingSpinner v-if="isLoading" class="setup__loading" />
      <template v-else>
        <StepIndicator :steps="stepLabels" :current="index" />
        <!-- steps stay alive so Back returns to the choices already made -->
        <KeepAlive>
          <SetupWelcome
            v-if="step === 'welcome'"
            @next="next"
            @dismiss="skipSetup"
          />
          <SetupAccount
            v-else-if="step === 'account'"
            @back="back"
            @skip="next"
            @next="next"
          />
          <SetupCamera
            v-else-if="step === 'camera'"
            @back="back"
            @next="camerasDone"
          />
          <SetupDetector
            v-else-if="step === 'detector'"
            :camera-count="cameras.length"
            @back="back"
            @skip="detectorDone($event)"
            @next="detectorDone($event, true)"
          />
          <SetupHwAccel
            v-else-if="step === 'hwaccel'"
            :detector-hardware-key="detectorHardwareKey"
            :detect-codecs="detectCodecs"
            @back="back"
            @skip="next"
            @next="hwaccelDone"
          />
          <SetupRecording
            v-else-if="step === 'recording'"
            :camera-count="cameras.length"
            @back="back"
            @skip="next"
            @next="recordingDone"
          />
          <SetupComplete
            v-else
            :cameras="cameras"
            :configured="configured"
            :restart-required="restartRequired"
            @back="back"
          />
        </KeepAlive>
      </template>
    </main>
  </div>
</template>

<style scoped>
.setup {
  display: grid;
  block-size: 100dvh;
  padding: 16px;
  overflow-y: auto;
  background: var(--backdrop-page);
}

.setup__card {
  display: grid;
  gap: 20px;
  inline-size: min(100%, 520px);
  /* auto margins center it, yet keep the top reachable on a tall step */
  margin: auto;
  padding: 24px;
  border-radius: var(--radius);
  border: 1px solid var(--glass-border);
  background: var(--bg-panel);
  box-shadow: var(--shadow-popover);
}

.setup__loading {
  justify-self: center;
  margin-block: 48px;
}

@media (max-width: 480px) {
  .setup__card {
    padding: 16px;
  }
}
</style>
