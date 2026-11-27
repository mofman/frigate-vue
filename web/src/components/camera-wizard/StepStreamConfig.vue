<script setup lang="ts">
/** Step 3: stream urls, their roles and camera features. */
import { computed, shallowRef, watch } from "vue";
import { ExternalLink, Plus, Trash2 } from "@lucide/vue";
import AppButton from "@/components/ui/AppButton.vue";
import IconButton from "@/components/ui/IconButton.vue";
import InfoTip from "@/components/ui/InfoTip.vue";
import SelectField from "@/components/ui/SelectField.vue";
import TextField from "@/components/ui/TextField.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import WizardFooter from "@/components/ui/WizardFooter.vue";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import {
  STREAM_ROLES,
  type OnvifSettings,
  type StreamConfig,
  type StreamRole,
  type WizardData,
} from "@/types/cameraWizard";
import {
  canLeaveStep,
  hevcRecordingStreamId,
  isOnvifInvalid,
  isRoleBlocked,
  maskUri,
  testSummary,
} from "@/utils/cameraWizard";
import { probeStream } from "./cameraProbe";
import WizardPanel from "./WizardPanel.vue";

const props = defineProps<{ data: WizardData }>();
const emit = defineEmits<{
  back: [];
  next: [];
  update: [patch: Partial<WizardData>];
}>();

const { t } = useT(["views/settings", "common"]);
const testing = shallowRef<Record<string, boolean>>({});
const onvifDetailsOpen = shallowRef(false);

const streams = computed(() => props.data.streams);
const candidates = computed(() =>
  props.data.probeMode ? (props.data.probeCandidates ?? []) : [],
);
const candidateTests = computed(() => props.data.candidateTests ?? {});
const onvif = computed(() => props.data.onvif);
const ptzSupported = computed(
  () => props.data.probeResult?.ptz_supported === true,
);
const onvifInvalid = computed(() => isOnvifInvalid(onvif.value));
const hasDetect = computed(() =>
  streams.value.some((stream) => stream.roles.includes("detect")),
);
const appleStreamId = computed(() => hevcRecordingStreamId(streams.value));
const isTesting = computed(() => Object.values(testing.value).some(Boolean));

// seeded once from the probe, never over a later toggle-off or edit
if (ptzSupported.value && props.data.onvif === undefined) {
  emit("update", {
    onvif: {
      enabled: props.data.probeResult?.pan_tilt_supported === true,
      host: props.data.host ?? "",
      port: props.data.onvifPort ?? 8000,
      user: props.data.username ?? "",
      password: props.data.password ?? "",
    },
  });
}

const appleBrowser =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  /^((?!chrome|chromium|android).)*safari/i.test(navigator.userAgent);
watch(
  appleStreamId,
  (id) => {
    // undefined, not false: a deliberate toggle-off must not be re-seeded
    if (appleBrowser && id && props.data.appleCompatibility === undefined) {
      emit("update", { appleCompatibility: true });
    }
  },
  { immediate: true },
);

function setStreams(next: StreamConfig[]) {
  emit("update", { streams: next });
}

function updateStream(id: string, patch: Partial<StreamConfig>) {
  setStreams(
    streams.value.map((stream) =>
      stream.id === id ? { ...stream, ...patch } : stream,
    ),
  );
}

function updateOnvif(patch: Partial<OnvifSettings>) {
  emit("update", {
    onvif: { enabled: false, host: "", port: 8000, ...onvif.value, ...patch },
  });
}

function addStream() {
  const used = new Set(streams.value.map((stream) => stream.url));
  const url = candidates.value.find((candidate) => !used.has(candidate)) ?? "";
  setStreams([
    ...streams.value,
    {
      id: `stream_${Date.now()}`,
      url,
      roles: [],
      testResult: url ? candidateTests.value[url] : undefined,
      userTested: !!(url && candidateTests.value[url]),
    },
  ]);
}

function toggleRole(stream: StreamConfig, role: StreamRole, on: boolean) {
  if (on && isRoleBlocked(stream, role, streams.value)) return;
  updateStream(stream.id, {
    roles: on
      ? [...stream.roles, role]
      : stream.roles.filter((value) => value !== role),
  });
}

function candidateOptions(stream: StreamConfig) {
  const used = new Set(
    streams.value
      .filter((other) => other.id !== stream.id)
      .map((other) => other.url),
  );
  return candidates.value
    .filter((candidate) => !used.has(candidate))
    .map((candidate) => ({ value: candidate, label: maskUri(candidate) }));
}

function chooseCandidate(stream: StreamConfig, url: string) {
  updateStream(stream.id, {
    url,
    testResult: candidateTests.value[url],
    userTested: !!candidateTests.value[url],
  });
}

async function testStream(stream: StreamConfig) {
  testing.value = { ...testing.value, [stream.id]: true };
  const testResult = await probeStream(stream.url);
  testing.value = { ...testing.value, [stream.id]: false };
  emit("update", {
    streams: props.data.streams.map((current) =>
      current.id === stream.id
        ? { ...current, testResult, userTested: true }
        : current,
    ),
    candidateTests: { ...candidateTests.value, [stream.url]: testResult },
  });
  if (testResult.success) {
    showToast(t("cameraWizard.step3.testSuccess"), "success");
  } else {
    showToast(
      t("cameraWizard.commonErrors.testFailed", {
        error: testResult.error || t("cameraWizard.step3.testFailed"),
      }),
      "error",
      6000,
    );
  }
}
</script>

<template>
  <div class="wizard-step">
    <p class="wizard-step__intro">{{ t("cameraWizard.step3.description") }}</p>

    <WizardPanel
      v-for="(stream, index) in streams"
      :key="stream.id"
      :title="t('cameraWizard.step3.streamTitle', { number: index + 1 })"
      :summary="
        stream.testResult?.success
          ? testSummary(
              stream.testResult,
              t('cameraWizard.testResultLabels.fps'),
            )
          : undefined
      "
      :connected="stream.testResult?.success"
      :connected-label="t('cameraWizard.step3.connected')"
      :disconnected-label="t('cameraWizard.step3.notConnected')"
    >
      <template v-if="streams.length > 1" #actions>
        <IconButton
          size="sm"
          :label="t('common:button.delete')"
          @click="setStreams(streams.filter((s) => s.id !== stream.id))"
        >
          <Trash2 />
        </IconButton>
      </template>

      <div class="wizard-step__url">
        <div class="wizard-step__url-field">
          <SelectField
            v-if="candidates.length"
            :model-value="stream.url"
            :label="t('cameraWizard.step3.url')"
            :placeholder="t('cameraWizard.step3.selectStream')"
            :options="candidateOptions(stream)"
            @update:model-value="chooseCandidate(stream, $event)"
          />
          <TextField
            v-else
            :model-value="stream.url"
            autocomplete="off"
            :label="t('cameraWizard.step3.url')"
            :placeholder="t('cameraWizard.step3.streamUrlPlaceholder')"
            @update:model-value="
              updateStream(stream.id, { url: $event, testResult: undefined })
            "
          />
        </div>
        <AppButton
          :disabled="testing[stream.id] || !stream.url.trim()"
          @click="testStream(stream)"
        >
          {{ t("cameraWizard.step3.testStream") }}
        </AppButton>
      </div>

      <div
        v-if="
          stream.testResult && !stream.testResult.success && stream.userTested
        "
        class="wizard-step__failure"
        role="alert"
      >
        <strong>{{ t("cameraWizard.step3.testFailedTitle") }}</strong>
        <p>{{ stream.testResult.error }}</p>
      </div>

      <div class="wizard-step__section">
        <h4>
          {{ t("cameraWizard.step3.roles") }}
          <InfoTip :label="t('cameraWizard.step3.rolesPopover.title')">
            <strong>{{ t("cameraWizard.step3.rolesPopover.title") }}</strong>
            <p v-for="role in STREAM_ROLES" :key="role">
              <strong>{{ role }}</strong
              >: {{ t(`cameraWizard.step3.rolesPopover.${role}`) }}
            </p>
            <a
              href="https://docs.frigate.video/configuration/cameras"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t("common:readTheDocumentation") }}
              <ExternalLink :size="12" />
            </a>
          </InfoTip>
        </h4>
        <ToggleSwitch
          v-for="role in STREAM_ROLES"
          :key="role"
          :model-value="stream.roles.includes(role)"
          :label="role"
          :disabled="isRoleBlocked(stream, role, streams)"
          @update:model-value="toggleRole(stream, role, $event)"
        />
      </div>

      <div class="wizard-step__section">
        <h4>
          {{ t("cameraWizard.step3.featuresTitle") }}
          <InfoTip :label="t('cameraWizard.step3.featuresPopover.title')">
            <strong>{{ t("cameraWizard.step3.featuresPopover.title") }}</strong>
            <p>{{ t("cameraWizard.step3.featuresPopover.description") }}</p>
            <a
              href="https://docs.frigate.video/configuration/restream#reduce-connections-to-camera"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ t("common:readTheDocumentation") }}
              <ExternalLink :size="12" />
            </a>
          </InfoTip>
        </h4>
        <ToggleSwitch
          :model-value="stream.restream ?? false"
          :label="t('cameraWizard.step3.go2rtc')"
          @update:model-value="updateStream(stream.id, { restream: $event })"
        />
        <template v-if="appleStreamId === stream.id">
          <ToggleSwitch
            :model-value="data.appleCompatibility ?? false"
            :label="t('cameraWizard.step3.appleCompatibility.title')"
            @update:model-value="
              $emit('update', { appleCompatibility: $event })
            "
          />
          <p class="wizard-step__hint">
            {{ t("cameraWizard.step3.appleCompatibility.description") }}
          </p>
        </template>
      </div>
    </WizardPanel>

    <AppButton class="wizard-step__add" @click="addStream">
      <template #icon><Plus /></template>
      {{ t("cameraWizard.step3.addAnotherStream") }}
    </AppButton>

    <WizardPanel v-if="ptzSupported">
      <ToggleSwitch
        :model-value="onvif?.enabled ?? false"
        :label="t('cameraWizard.step3.ptz.title')"
        @update:model-value="updateOnvif({ enabled: $event })"
      />
      <p class="wizard-step__hint">
        {{ t("cameraWizard.step3.ptz.detectedNote") }}
      </p>
      <template v-if="onvif?.enabled">
        <button
          type="button"
          class="wizard-step__disclosure"
          :aria-expanded="onvifDetailsOpen || onvifInvalid"
          @click="onvifDetailsOpen = !onvifDetailsOpen"
        >
          {{ t("cameraWizard.step3.ptz.connectionDetails") }}
        </button>
        <div v-if="onvifDetailsOpen || onvifInvalid" class="wizard-step__onvif">
          <TextField
            :model-value="onvif.host"
            autocomplete="off"
            placeholder="192.168.1.100"
            :label="t('cameraWizard.step3.ptz.host')"
            @update:model-value="updateOnvif({ host: $event })"
          />
          <TextField
            :model-value="onvif.port ? String(onvif.port) : ''"
            inputmode="numeric"
            placeholder="8000"
            :label="t('cameraWizard.step3.ptz.port')"
            @update:model-value="
              updateOnvif({ port: Number.parseInt($event, 10) || 0 })
            "
          />
          <TextField
            :model-value="onvif.user ?? ''"
            autocomplete="off"
            :label="t('cameraWizard.step3.ptz.username')"
            :placeholder="t('cameraWizard.step1.usernamePlaceholder')"
            @update:model-value="updateOnvif({ user: $event })"
          />
          <TextField
            :model-value="onvif.password ?? ''"
            type="password"
            autocomplete="new-password"
            :label="t('cameraWizard.step3.ptz.password')"
            :placeholder="t('cameraWizard.step1.passwordPlaceholder')"
            :show-label="t('users.dialog.form.password.show')"
            :hide-label="t('users.dialog.form.password.hide')"
            @update:model-value="updateOnvif({ password: $event })"
          />
        </div>
      </template>
    </WizardPanel>

    <p v-if="!hasDetect" class="wizard-step__warning" role="alert">
      {{ t("cameraWizard.step3.detectRoleWarning") }}
    </p>
    <p v-if="onvifInvalid" class="wizard-step__warning" role="alert">
      {{ t("cameraWizard.step3.ptz.hostRequiredWarning") }}
    </p>

    <WizardFooter
      :back-label="t('common:button.back')"
      :next-label="t('common:button.next')"
      :next-disabled="!canLeaveStep(2, data) || isTesting"
      @back="$emit('back')"
      @next="$emit('next')"
    />
  </div>
</template>

<style scoped>
.wizard-step {
  display: grid;
  gap: 14px;
}

.wizard-step__intro,
.wizard-step__hint {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.wizard-step__url {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}

.wizard-step__url-field {
  flex: 1 1 240px;
  min-inline-size: 0;
}

.wizard-step__failure,
.wizard-step__warning {
  padding: 8px 10px;
  border-radius: var(--radius-xs);
  background: var(--danger-surface);
  overflow-wrap: anywhere;
  font-size: var(--text-sm);
  color: var(--danger);
}

.wizard-step__section {
  display: grid;
  gap: 2px;

  h4 {
    display: flex;
    align-items: center;
    gap: 2px;
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-secondary);
  }

  a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent-text);
  }
}

.wizard-step__add {
  justify-self: start;
}

.wizard-step__disclosure {
  justify-self: start;
  font-size: var(--text-sm);
  color: var(--accent-text);
}

.wizard-step__onvif {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
</style>
