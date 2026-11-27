<script setup lang="ts">
/** Device details and stream urls found by an ONVIF probe. */
import { computed } from "vue";
import { CircleCheck, Copy } from "@lucide/vue";
import AppButton from "@/components/ui/AppButton.vue";
import IconButton from "@/components/ui/IconButton.vue";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import type { OnvifProbeResponse, TestResult } from "@/types/cameraWizard";
import { maskUri, testSummary } from "@/utils/cameraWizard";
import WizardPanel from "./WizardPanel.vue";

const props = defineProps<{
  result: OnvifProbeResponse;
  tests: Record<string, TestResult>;
  testing: Record<string, boolean>;
}>();
defineEmits<{ test: [uri: string] }>();

const { t } = useT(["views/settings", "common"]);
const candidates = computed(() =>
  (props.result.rtsp_candidates ?? []).filter(
    (candidate) => candidate.source === "GetStreamUri",
  ),
);
const yesNo = (value: boolean) =>
  value ? t("common:button.yes") : t("common:button.no");
const details = computed(() => {
  const r = props.result;
  return [
    [t("cameraWizard.step2.manufacturer"), r.manufacturer],
    [t("cameraWizard.step2.model"), r.model],
    [t("cameraWizard.step2.firmware"), r.firmware_version],
    [t("cameraWizard.step2.profiles"), r.profiles_count],
    [
      t("cameraWizard.step2.ptzSupport"),
      r.ptz_supported === undefined ? undefined : yesNo(r.ptz_supported),
    ],
    [
      t("cameraWizard.step2.autotrackingSupport"),
      r.ptz_supported && r.autotrack_supported ? yesNo(true) : undefined,
    ],
    [
      t("cameraWizard.step2.presets"),
      r.ptz_supported ? r.presets_count : undefined,
    ],
  ].filter(([, value]) => value !== undefined && value !== "");
});

async function copy(uri: string) {
  try {
    await navigator.clipboard.writeText(uri);
    showToast(t("cameraWizard.step2.uriCopied"), "success");
  } catch {
    // clipboard access is refused outside secure contexts
  }
}
</script>

<template>
  <p class="probe__success">
    <CircleCheck :size="16" />{{ t("cameraWizard.step2.probeSuccessful") }}
  </p>
  <WizardPanel :title="t('cameraWizard.step2.deviceInfo')">
    <dl class="probe__details">
      <template v-for="[label, value] in details" :key="label">
        <dt>{{ label }}</dt>
        <dd>{{ value }}</dd>
      </template>
    </dl>
  </WizardPanel>

  <p v-if="!candidates.length" class="probe__error" role="alert">
    {{ t("cameraWizard.step2.noRtspCandidates") }}
  </p>
  <template v-else>
    <div>
      <h3 class="probe__title">{{ t("cameraWizard.step2.rtspCandidates") }}</h3>
      <p class="probe__hint">
        {{ t("cameraWizard.step2.rtspCandidatesDescription") }}
      </p>
    </div>
    <WizardPanel
      v-for="(candidate, index) in candidates"
      :key="candidate.uri"
      :title="
        t('cameraWizard.step2.candidateStreamTitle', { number: index + 1 })
      "
      :summary="
        tests[candidate.uri]?.success
          ? testSummary(
              tests[candidate.uri],
              t('cameraWizard.testResultLabels.fps'),
            )
          : undefined
      "
      :connected="tests[candidate.uri]?.success"
      :connected-label="t('cameraWizard.step2.connected')"
      :disconnected-label="t('cameraWizard.step2.notConnected')"
    >
      <div class="probe__candidate">
        <code>{{ maskUri(candidate.uri) }}</code>
        <IconButton
          size="sm"
          :label="t('cameraWizard.step2.uriCopy')"
          @click="copy(candidate.uri)"
        >
          <Copy />
        </IconButton>
        <AppButton
          size="sm"
          :disabled="testing[candidate.uri]"
          @click="$emit('test', candidate.uri)"
        >
          {{ t("cameraWizard.step2.testConnection") }}
        </AppButton>
      </div>
    </WizardPanel>
  </template>
</template>

<style scoped>
.probe__success {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-md);
  color: var(--live);
}

.probe__details {
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
    overflow-wrap: anywhere;
  }
}

.probe__error {
  font-size: var(--text-md);
  color: var(--danger);
}

.probe__title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: 600;
}

.probe__hint {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.probe__candidate {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  code {
    flex: 1 1 200px;
    min-inline-size: 0;
    overflow-wrap: anywhere;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }
}
</style>
