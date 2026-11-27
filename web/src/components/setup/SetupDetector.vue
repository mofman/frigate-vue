<script setup lang="ts">
/** Chooses the hardware that runs object detection. */
import { computed, shallowRef } from "vue";
import { ExternalLink } from "@lucide/vue";
import { http } from "@/api/http";
import { useQuery } from "@/api/query";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import RadioOption from "@/components/ui/RadioOption.vue";
import SelectField from "@/components/ui/SelectField.vue";
import { useConfig } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import type { DetectionHardware, FrigatePlusModel } from "@/types/hardware";
import {
  CPU_FALLBACK,
  detectorConfig,
  MODEL_REQUIRED_DETECTORS,
} from "@/utils/setupConfig";
import SetupNote from "./SetupNote.vue";
import SetupStep from "./SetupStep.vue";

const props = defineProps<{ cameraCount: number }>();
const emit = defineEmits<{
  back: [];
  next: [hardwareKey: string];
  skip: [hardwareKey?: string];
}>();

const { t } = useT(["views/setup", "common"]);
const { data: config } = useConfig();
const {
  data: hardware,
  error: probeError,
  isLoading,
} = useQuery<DetectionHardware[]>("hardware/probe", {
  revalidateOnFocus: false,
});

// the cpu is always probed, so an empty list means the probe failed
const options = computed(() =>
  hardware.value?.length ? hardware.value : CPU_FALLBACK,
);
// the prober orders accelerators ahead of the cpu
const recommendedKey = computed(() => options.value[0].key);
const chosenKey = shallowRef<string>();
const selectedKey = computed({
  get: () => chosenKey.value ?? recommendedKey.value,
  set: (value: string) => {
    chosenKey.value = value;
    plusModelId.value = "";
  },
});
const selected = computed(
  () =>
    options.value.find((entry) => entry.key === selectedKey.value) ??
    options.value[0],
);

const needsModel = computed(() =>
  MODEL_REQUIRED_DETECTORS.includes(selected.value.detector),
);
const plusEnabled = computed(() => !!config.value?.plus?.enabled);
const plusModelId = shallowRef("");
const { data: plusModels } = useQuery<FrigatePlusModel[]>(() =>
  plusEnabled.value && needsModel.value ? "plus/models" : null,
);
const plusOptions = computed(() =>
  (plusModels.value ?? [])
    .filter((model) =>
      model.supportedDetectors.includes(selected.value.detector),
    )
    .map((model) => ({
      value: model.id,
      label: `${model.name} (${model.width}x${model.height})`,
    })),
);

const saving = shallowRef(false);

async function save() {
  if (needsModel.value && !plusModelId.value) {
    emit("skip", selected.value.key);
    return;
  }
  saving.value = true;
  try {
    await http.put("config/set", {
      config_data: detectorConfig(
        selected.value,
        props.cameraCount,
        needsModel.value ? plusModelId.value : undefined,
      ),
      requires_restart: 1,
    });
    emit("next", selected.value.key);
  } catch {
    showToast(t("setupWizard.errors.saveFailed"), "error");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="isLoading" class="setup-loading">
    <LoadingSpinner />
    <p>{{ t("setupWizard.detector.detecting") }}</p>
  </div>
  <SetupStep
    v-else
    :title="t('setupWizard.detector.title')"
    :description="t('setupWizard.detector.description')"
    can-skip
    :busy="saving"
    :next-label="
      needsModel && !plusModelId
        ? t('setupWizard.detector.continueWithout')
        : undefined
    "
    @back="$emit('back')"
    @skip="emit('skip', selected.key)"
    @next="save"
  >
    <SetupNote v-if="probeError">
      {{ t("setupWizard.detector.probeFailed") }}
    </SetupNote>
    <div class="setup-options" role="radiogroup">
      <RadioOption
        v-for="entry in options"
        :key="entry.key"
        v-model="selectedKey"
        name="setup-detector"
        :value="entry.key"
        :label="entry.count > 1 ? `${entry.name} (${entry.count})` : entry.name"
        :badge="
          entry.key === recommendedKey && entry.key !== 'cpu'
            ? t('setupWizard.detector.recommended')
            : undefined
        "
      />
    </div>
    <SetupNote v-if="needsModel">
      <p>
        {{ t("setupWizard.detector.modelRequired", { name: selected.name }) }}
      </p>
      <SelectField
        v-if="plusEnabled"
        v-model="plusModelId"
        :label="t('setupWizard.detector.plusModelPlaceholder')"
        :placeholder="t('setupWizard.detector.plusModelPlaceholder')"
        :options="plusOptions"
      />
      <a
        v-else
        class="setup-link"
        href="https://docs.frigate.video/configuration/object_detectors"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ t("common:readTheDocumentation") }}
        <ExternalLink :size="12" />
      </a>
    </SetupNote>
  </SetupStep>
</template>

<style scoped>
.setup-loading {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding-block: 48px;
  font-size: var(--text-md);
  color: var(--text-secondary);
}

.setup-options {
  display: grid;
  gap: 8px;
}

.setup-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--accent-text);
}
</style>
