<script setup lang="ts">
/** Step 1: camera name, credentials and how to find its streams. */
import { computed, reactive, shallowRef } from "vue";
import InfoTip from "@/components/ui/InfoTip.vue";
import RadioOption from "@/components/ui/RadioOption.vue";
import SelectField from "@/components/ui/SelectField.vue";
import TextField from "@/components/ui/TextField.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import WizardFooter from "@/components/ui/WizardFooter.vue";
import { useConfig } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import {
  CAMERA_BRANDS,
  type CameraBrand,
  type WizardData,
} from "@/types/cameraWizard";
import {
  canContinueNameStep,
  validateNameStep,
  type NameStepErrors,
} from "@/utils/cameraWizard";

const props = defineProps<{ data: WizardData }>();
const emit = defineEmits<{ cancel: []; next: [patch: Partial<WizardData>] }>();

const { t } = useT(["views/settings", "common"]);
const { data: config } = useConfig();

const form = reactive({
  cameraName: props.data.cameraName ?? "",
  host: props.data.host ?? "",
  username: props.data.username ?? "",
  password: props.data.password ?? "",
  method: (props.data.probeMode ?? true) ? "probe" : "manual",
  onvifPort: String(props.data.onvifPort ?? 80),
  useDigestAuth: props.data.useDigestAuth ?? false,
  brand: (props.data.brandTemplate ?? "dahua") as string,
  customUrl: props.data.customUrl ?? "",
});
const errors = shallowRef<NameStepErrors>({});

const stepForm = computed(() => ({
  cameraName: form.cameraName,
  host: form.host,
  probeMode: form.method === "probe",
  brand: form.brand as CameraBrand,
  customUrl: form.customUrl,
  onvifPort: form.onvifPort,
}));
const brandOptions = computed(() =>
  CAMERA_BRANDS.map((brand) => ({
    value: brand.value,
    label: brand.value === "other" ? t("common:label.other") : brand.label,
  })),
);
const selectedBrand = computed(() =>
  CAMERA_BRANDS.find((brand) => brand.value === form.brand),
);
const errorText = (key?: string) => (key ? t(key) : undefined);

function submit() {
  errors.value = validateNameStep(
    stepForm.value,
    Object.keys(config.value?.cameras ?? {}),
  );
  if (Object.keys(errors.value).length) return;
  emit("next", {
    cameraName: form.cameraName.trim(),
    host: form.host.trim(),
    username: form.username,
    password: form.password,
    probeMode: form.method === "probe",
    onvifPort: Number(form.onvifPort) || 80,
    useDigestAuth: form.useDigestAuth,
    brandTemplate: form.brand as CameraBrand,
    customUrl: form.customUrl.trim(),
  });
}
</script>

<template>
  <form class="wizard-step" novalidate @submit.prevent="submit">
    <p class="wizard-step__intro">{{ t("cameraWizard.step1.description") }}</p>
    <TextField
      v-model="form.cameraName"
      autocomplete="off"
      :label="t('cameraWizard.step1.cameraName')"
      :placeholder="t('cameraWizard.step1.cameraNamePlaceholder')"
      :error="errorText(errors.cameraName)"
    />
    <TextField
      v-model="form.host"
      autocomplete="off"
      placeholder="192.168.1.100"
      :label="t('cameraWizard.step1.host')"
    />
    <div class="wizard-step__columns">
      <TextField
        v-model="form.username"
        autocomplete="off"
        :label="t('cameraWizard.step1.username')"
        :placeholder="t('cameraWizard.step1.usernamePlaceholder')"
      />
      <TextField
        v-model="form.password"
        type="password"
        autocomplete="new-password"
        :label="t('cameraWizard.step1.password')"
        :placeholder="t('cameraWizard.step1.passwordPlaceholder')"
        :show-label="t('views/settings:users.dialog.form.password.show')"
        :hide-label="t('views/settings:users.dialog.form.password.hide')"
      />
    </div>

    <fieldset class="wizard-step__group">
      <legend>{{ t("cameraWizard.step1.detectionMethod") }}</legend>
      <RadioOption
        v-model="form.method"
        name="camera-detection-method"
        value="probe"
        :label="t('cameraWizard.step1.probeMode')"
      />
      <RadioOption
        v-model="form.method"
        name="camera-detection-method"
        value="manual"
        :label="t('cameraWizard.step1.manualMode')"
      />
      <p class="wizard-step__hint">
        {{ t("cameraWizard.step1.detectionMethodDescription") }}
      </p>
    </fieldset>

    <template v-if="form.method === 'probe'">
      <TextField
        v-model="form.onvifPort"
        inputmode="numeric"
        placeholder="80"
        :label="t('cameraWizard.step1.onvifPort')"
        :hint="t('cameraWizard.step1.onvifPortDescription')"
        :error="errorText(errors.onvifPort)"
      />
      <div>
        <ToggleSwitch
          v-model="form.useDigestAuth"
          :label="t('cameraWizard.step1.useDigestAuth')"
        />
        <p class="wizard-step__hint">
          {{ t("cameraWizard.step1.useDigestAuthDescription") }}
        </p>
      </div>
    </template>
    <template v-else>
      <SelectField
        v-model="form.brand"
        :label="t('cameraWizard.step1.cameraBrand')"
        :options="brandOptions"
      >
        <template v-if="selectedBrand?.value !== 'other'" #label-extra>
          <InfoTip :label="t('cameraWizard.step1.brandInformation')">
            <strong>{{ selectedBrand?.label }}</strong>
            <p class="wizard-step__url">
              {{
                t("cameraWizard.step1.brandUrlFormat", {
                  exampleUrl: selectedBrand?.exampleUrl,
                })
              }}
            </p>
          </InfoTip>
        </template>
      </SelectField>
      <TextField
        v-if="form.brand === 'other'"
        v-model="form.customUrl"
        autocomplete="off"
        :label="t('cameraWizard.step1.customUrl')"
        :placeholder="t('cameraWizard.step1.customUrlPlaceholder')"
        :error="errorText(errors.customUrl)"
      />
    </template>

    <WizardFooter
      :back-label="t('common:button.cancel')"
      :next-label="t('common:button.continue')"
      :next-disabled="!canContinueNameStep(stepForm)"
      @back="$emit('cancel')"
      @next="submit"
    />
  </form>
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

.wizard-step__hint {
  color: var(--text-tertiary);
}

.wizard-step__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.wizard-step__group {
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

.wizard-step__url {
  margin-block-start: 4px;
  overflow-wrap: anywhere;
}
</style>
