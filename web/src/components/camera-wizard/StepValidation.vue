<script setup lang="ts">
/** Step 4: connect each stream, review advice and save the camera. */
import { computed, shallowRef } from "vue";
import { CircleCheck, TriangleAlert, X } from "@lucide/vue";
import AppButton from "@/components/ui/AppButton.vue";
import InfoTip from "@/components/ui/InfoTip.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import WizardFooter from "@/components/ui/WizardFooter.vue";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import type {
  StreamConfig,
  TestResult,
  WizardData,
} from "@/types/cameraWizard";
import { maskUri, testSummary } from "@/utils/cameraWizard";
import { getStreamIssues } from "@/utils/streamIssues";
import { probeStream, streamHasBackchannel } from "./cameraProbe";
import StreamPreview from "./StreamPreview.vue";
import WizardPanel from "./WizardPanel.vue";

const props = defineProps<{ data: WizardData; saving?: boolean }>();
const emit = defineEmits<{
  back: [];
  update: [patch: Partial<WizardData>];
  save: [hasBackchannel: boolean];
}>();

const { t } = useT(["views/settings", "common"]);
const validatingAll = shallowRef(false);
const checkingBackchannel = shallowRef(false);
const testing = shallowRef<Record<string, boolean>>({});
const registered = shallowRef<Record<string, string>>({});

const streams = computed(() => props.data.streams);
const canSave = computed(
  () =>
    !!props.data.cameraName &&
    streams.value.length > 0 &&
    streams.value.some((stream) => stream.roles.includes("detect")) &&
    streams.value.every((stream) => stream.testResult),
);

function patchStream(id: string, patch: Partial<StreamConfig>) {
  emit("update", {
    streams: props.data.streams.map((stream) =>
      stream.id === id ? { ...stream, ...patch } : stream,
    ),
  });
}

async function validateStream(stream: StreamConfig, index: number) {
  testing.value = { ...testing.value, [stream.id]: true };
  const testResult = await probeStream(stream.url);
  testing.value = { ...testing.value, [stream.id]: false };
  patchStream(stream.id, { testResult });
  if (testResult.success) {
    showToast(
      t("cameraWizard.step4.streamValidated", { number: index + 1 }),
      "success",
    );
  } else {
    showToast(
      t("cameraWizard.step4.streamValidationFailed", { number: index + 1 }),
      "error",
    );
  }
}

async function validateAll() {
  validatingAll.value = true;
  const pending = streams.value.filter(
    (stream) => !stream.testResult?.success && stream.url.trim(),
  );
  const results = await Promise.all(
    pending.map(
      async (stream) =>
        [stream.id, await probeStream(stream.url)] as [string, TestResult],
    ),
  );
  validatingAll.value = false;
  if (!results.length) return;

  const byId = new Map(results);
  emit("update", {
    streams: props.data.streams.map((stream) => {
      const testResult = byId.get(stream.id);
      return testResult ? { ...stream, testResult } : stream;
    }),
  });
  if (results.every(([, result]) => result.success)) {
    showToast(t("cameraWizard.step4.reconnectionSuccess"), "success");
  } else {
    showToast(t("cameraWizard.step4.reconnectionPartial"), "error");
  }
}

function toggleConnection(stream: StreamConfig, index: number) {
  if (stream.testResult?.success) {
    patchStream(stream.id, { testResult: undefined });
  } else {
    void validateStream(stream, index);
  }
}

function connectLabel(stream: StreamConfig) {
  if (stream.testResult?.success) {
    return t("cameraWizard.step4.disconnectStream");
  }
  return testing.value[stream.id]
    ? t("cameraWizard.step4.connectingStream")
    : t("cameraWizard.step4.connectStream");
}

function issues(stream: StreamConfig) {
  return getStreamIssues(
    {
      url: stream.url,
      roles: stream.roles,
      brand: props.data.brandTemplate,
      reolinkProtocol: props.data.reolinkProtocol,
      useFfmpeg: stream.useFfmpeg,
      restream: stream.restream,
      testResult: stream.testResult,
    },
    t,
  );
}

async function save() {
  checkingBackchannel.value = true;
  // ffmpeg compatibility mode guarantees no backchannel connection
  const checks = streams.value.flatMap((stream) => {
    const id = registered.value[stream.id];
    return id && stream.testResult?.success && !stream.useFfmpeg
      ? [streamHasBackchannel(id)]
      : [];
  });
  const results = await Promise.all(checks);
  checkingBackchannel.value = false;
  emit("save", results.some(Boolean));
}
</script>

<template>
  <div class="wizard-step">
    <p class="wizard-step__intro">{{ t("cameraWizard.step4.description") }}</p>
    <div class="wizard-step__heading">
      <h3>{{ t("cameraWizard.step4.validationTitle") }}</h3>
      <AppButton size="sm" :disabled="validatingAll" @click="validateAll">
        {{
          validatingAll
            ? t("cameraWizard.step4.connecting")
            : t("cameraWizard.step4.connectAllStreams")
        }}
      </AppButton>
    </div>

    <WizardPanel
      v-for="(stream, index) in streams"
      :key="stream.id"
      :title="t('cameraWizard.step4.streamTitle', { number: index + 1 })"
      :summary="
        stream.testResult?.success
          ? testSummary(
              stream.testResult,
              t('cameraWizard.testResultLabels.fps'),
            )
          : undefined
      "
      :connected="stream.testResult?.success"
      :connected-label="t('cameraWizard.step2.connected')"
      :disconnected-label="t('cameraWizard.step2.notConnected')"
    >
      <template #heading-extra>
        <span
          v-for="role in stream.roles"
          :key="role"
          class="wizard-step__role"
        >
          {{ role }}
        </span>
      </template>

      <template v-if="stream.testResult?.success">
        <StreamPreview
          :stream="stream"
          @registered="registered = { ...registered, [stream.id]: $event }"
        />
        <div class="wizard-step__ffmpeg">
          <ToggleSwitch
            class="wizard-step__ffmpeg-toggle"
            :model-value="stream.useFfmpeg ?? false"
            :label="t('cameraWizard.step4.ffmpegModule')"
            @update:model-value="patchStream(stream.id, { useFfmpeg: $event })"
          />
          <InfoTip :label="t('cameraWizard.step4.ffmpegModule')">
            {{ t("cameraWizard.step4.ffmpegModuleDescription") }}
          </InfoTip>
        </div>
      </template>

      <div class="wizard-step__url">
        <code>{{ maskUri(stream.url) }}</code>
        <AppButton
          size="sm"
          :disabled="testing[stream.id] || !stream.url.trim()"
          @click="toggleConnection(stream, index)"
        >
          {{ connectLabel(stream) }}
        </AppButton>
      </div>

      <ul
        v-if="stream.testResult && issues(stream).length"
        class="wizard-step__issues"
        :aria-label="t('cameraWizard.step4.issues.title')"
      >
        <li
          v-for="issue in issues(stream)"
          :key="issue.rule"
          :class="`is-${issue.type}`"
        >
          <CircleCheck v-if="issue.type === 'good'" :size="14" />
          <TriangleAlert v-else-if="issue.type === 'warning'" :size="14" />
          <X v-else :size="14" />
          <span>{{ issue.message }}</span>
        </li>
      </ul>

      <div
        v-if="stream.testResult && !stream.testResult.success"
        class="wizard-step__failure"
        role="alert"
      >
        <strong>{{ t("cameraWizard.step2.testFailedTitle") }}</strong>
        <p>{{ stream.testResult.error }}</p>
      </div>
    </WizardPanel>

    <WizardFooter
      :back-label="t('common:button.back')"
      :next-label="
        saving
          ? t('common:button.saving')
          : t('cameraWizard.step4.saveAndApply')
      "
      :next-disabled="!canSave"
      :busy="saving || checkingBackchannel"
      @back="$emit('back')"
      @next="save"
    />
  </div>
</template>

<style scoped>
.wizard-step {
  display: grid;
  gap: 14px;
}

.wizard-step__intro {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.wizard-step__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  h3 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
  }
}

.wizard-step__role {
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-border);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.wizard-step__ffmpeg {
  display: flex;
  align-items: center;
  gap: 4px;
}

.wizard-step__ffmpeg-toggle {
  flex: 1;
}

.wizard-step__url {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
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

.wizard-step__issues {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 10px;
  border-radius: var(--radius-xs);
  background: var(--bg-deep);
  list-style: none;
  font-size: var(--text-sm);

  li {
    display: flex;
    align-items: flex-start;
    gap: 6px;
  }

  svg {
    flex-shrink: 0;
    margin-block-start: 2px;
  }

  .is-good {
    color: var(--live);
  }

  .is-warning {
    color: var(--warning);
  }

  .is-error {
    color: var(--danger);
  }
}

.wizard-step__failure {
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  background: var(--danger-surface);
  overflow-wrap: anywhere;
  font-size: var(--text-sm);
  color: var(--danger);
}
</style>
