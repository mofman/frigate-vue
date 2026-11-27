<script setup lang="ts">
/** Step 2: find streams over ONVIF, or test the brand's stream url. */
import { computed, onMounted, shallowRef } from "vue";
import { CircleCheck } from "@lucide/vue";
import { errorMessage } from "@/api/http";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import WizardFooter from "@/components/ui/WizardFooter.vue";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import type {
  OnvifProbeResponse,
  StreamConfig,
  TestResult,
  WizardData,
} from "@/types/cameraWizard";
import { brandStreamUrls } from "@/utils/cameraWizard";
import { detectReolinkProtocol, probeOnvif, probeStream } from "./cameraProbe";
import OnvifProbeResults from "./OnvifProbeResults.vue";
import WizardPanel from "./WizardPanel.vue";

const props = defineProps<{ data: WizardData }>();
const emit = defineEmits<{
  back: [];
  update: [patch: Partial<WizardData>];
  next: [patch?: Partial<WizardData>];
}>();

const { t } = useT(["views/settings", "common"]);
const probing = shallowRef(false);
const probeError = shallowRef<string>();
const probeResult = shallowRef<OnvifProbeResponse>();
const candidateTests = shallowRef<Record<string, TestResult>>({});
const testingCandidates = shallowRef<Record<string, boolean>>({});
const testing = shallowRef(false);
const testStatus = shallowRef("");
const testResult = shallowRef<TestResult>();

const candidateUris = computed(() =>
  (probeResult.value?.rtsp_candidates ?? [])
    .filter((candidate) => candidate.source === "GetStreamUri")
    .map((candidate) => candidate.uri),
);
const anyCandidateTesting = computed(() =>
  Object.values(testingCandidates.value).some(Boolean),
);
const failureText = (result?: TestResult) =>
  result?.error || t("cameraWizard.step2.testFailed");

async function probeCamera() {
  if (!props.data.host) {
    probeError.value = t("cameraWizard.step2.errors.hostRequired");
    return;
  }
  probing.value = true;
  probeError.value = undefined;
  probeResult.value = undefined;
  try {
    const result = await probeOnvif(props.data);
    if (!result.success) {
      probeError.value =
        result.message || t("cameraWizard.step2.probeNoSuccess");
      return;
    }
    probeResult.value = result;
    const patch: Partial<WizardData> = {
      probeMode: true,
      probeResult: result,
      probeCandidates: candidateUris.value,
      candidateTests: {},
    };
    const { host, username, password } = props.data;
    if (
      result.manufacturer?.toLowerCase().includes("reolink") &&
      host &&
      username &&
      password
    ) {
      const protocol = await detectReolinkProtocol(props.data);
      patch.reolinkProtocol = protocol;
      if (protocol === "http-flv") patch.brandTemplate = "reolink";
    }
    emit("update", patch);
  } catch (error) {
    probeError.value = t("cameraWizard.step2.probeFailed", {
      error: errorMessage(error),
    });
  } finally {
    probing.value = false;
  }
}

async function testCandidate(uri: string) {
  testingCandidates.value = { ...testingCandidates.value, [uri]: true };
  const result = await probeStream(uri);
  candidateTests.value = { ...candidateTests.value, [uri]: result };
  testingCandidates.value = { ...testingCandidates.value, [uri]: false };
}

function useCandidates() {
  const [first] = candidateUris.value;
  if (!first) return;
  const stream: StreamConfig = {
    id: `stream_${Date.now()}`,
    url: first,
    roles: ["detect"],
    testResult: candidateTests.value[first],
  };
  emit("next", {
    probeMode: true,
    probeCandidates: candidateUris.value,
    candidateTests: candidateTests.value,
    streams: [stream],
  });
}

async function testConnection() {
  testing.value = true;
  testStatus.value = t("cameraWizard.step2.testing.probingMetadata");
  testResult.value = undefined;

  let protocol = props.data.reolinkProtocol;
  const { brandTemplate, username, password } = props.data;
  if (brandTemplate === "reolink" && username && password) {
    protocol = await detectReolinkProtocol(props.data);
    emit("update", { reolinkProtocol: protocol });
  }

  const urls = brandStreamUrls(props.data, protocol);
  if (!urls.length) {
    testing.value = false;
    showToast(t("cameraWizard.commonErrors.noUrl"), "error");
    return;
  }

  let url = urls[0];
  let result: TestResult = { success: false };
  for (url of urls) {
    testStatus.value = t("cameraWizard.step2.testing.probingMetadata");
    result = await probeStream(url, {
      snapshot: true,
      onSnapshot: () => {
        testStatus.value = t("cameraWizard.step2.testing.fetchingSnapshot");
      },
    });
    if (result.success && result.resolution) break;
  }

  testResult.value = result;
  testing.value = false;
  testStatus.value = "";
  if (!result.success) return;
  emit("update", {
    streams: [
      {
        id: `stream_${Date.now()}`,
        url,
        roles: ["detect"],
        testResult: result,
        useFfmpeg: brandTemplate === "reolink" && url.startsWith("http://"),
      },
    ],
  });
}

function retry() {
  if (props.data.probeMode === false) void testConnection();
  else void probeCamera();
}

onMounted(retry);
</script>

<template>
  <div class="wizard-step">
    <template v-if="data.probeMode !== false">
      <p v-if="probing" class="wizard-step__status">
        <LoadingSpinner :size="16" :delay="0" />
        {{ t("cameraWizard.step2.probing") }}
      </p>
      <p v-else-if="probeError" class="wizard-step__error" role="alert">
        {{ probeError }}
      </p>
      <OnvifProbeResults
        v-else-if="probeResult"
        :result="probeResult"
        :tests="candidateTests"
        :testing="testingCandidates"
        @test="testCandidate"
      />
      <WizardFooter
        :back-label="t('common:button.back')"
        :back-disabled="probing"
        :next-label="
          probeError ? t('cameraWizard.step2.retry') : t('common:button.next')
        "
        :next-disabled="
          probing ||
          (!probeError && (anyCandidateTesting || !candidateUris.length))
        "
        @back="$emit('back')"
        @next="probeError ? probeCamera() : useCandidates()"
      />
    </template>

    <template v-else>
      <p v-if="testing" class="wizard-step__status">
        <LoadingSpinner :size="16" :delay="0" />{{ testStatus }}
      </p>
      <template v-else-if="testResult?.success">
        <p class="wizard-step__success">
          <CircleCheck :size="16" />{{ t("cameraWizard.step2.testSuccess") }}
        </p>
        <img
          v-if="testResult.snapshot"
          class="wizard-step__snapshot"
          :src="testResult.snapshot"
          :alt="t('cameraWizard.step2.streamDetails')"
        />
        <WizardPanel :title="t('cameraWizard.step2.streamDetails')">
          <dl class="wizard-step__details">
            <template v-if="testResult.resolution">
              <dt>{{ t("cameraWizard.testResultLabels.resolution") }}</dt>
              <dd>{{ testResult.resolution }}</dd>
            </template>
            <template v-if="testResult.fps">
              <dt>{{ t("cameraWizard.testResultLabels.fps") }}</dt>
              <dd>{{ testResult.fps }}</dd>
            </template>
            <template v-if="testResult.videoCodec">
              <dt>{{ t("cameraWizard.testResultLabels.video") }}</dt>
              <dd>{{ testResult.videoCodec }}</dd>
            </template>
            <template v-if="testResult.audioCodec">
              <dt>{{ t("cameraWizard.testResultLabels.audio") }}</dt>
              <dd>{{ testResult.audioCodec }}</dd>
            </template>
          </dl>
        </WizardPanel>
      </template>
      <div v-else-if="testResult" class="wizard-step__error" role="alert">
        <strong>{{ t("cameraWizard.step2.testFailedTitle") }}</strong>
        <p>{{ failureText(testResult) }}</p>
      </div>
      <WizardFooter
        :back-label="t('common:button.back')"
        :back-disabled="testing"
        :next-label="
          testResult?.success
            ? t('common:button.continue')
            : t('cameraWizard.step2.retry')
        "
        :next-disabled="testing"
        @back="$emit('back')"
        @next="testResult?.success ? $emit('next') : testConnection()"
      />
    </template>
  </div>
</template>

<style scoped>
.wizard-step {
  display: grid;
  gap: 14px;
}

.wizard-step__status,
.wizard-step__success {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-md);
  color: var(--text-secondary);
}

.wizard-step__success {
  color: var(--live);
}

.wizard-step__error {
  overflow-wrap: anywhere;
  font-size: var(--text-md);
  color: var(--danger);
}

.wizard-step__snapshot {
  justify-self: center;
  max-inline-size: 100%;
  max-block-size: 40dvh;
  border-radius: var(--radius-sm);
  object-fit: contain;
}

.wizard-step__details {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0;
  font-size: var(--text-sm);

  dt {
    color: var(--text-tertiary);
  }

  dd {
    margin: 0;
  }
}
</style>
