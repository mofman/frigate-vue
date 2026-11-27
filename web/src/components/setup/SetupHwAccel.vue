<script setup lang="ts">
/** Chooses how video is decoded. */
import { computed, shallowRef } from "vue";
import { http } from "@/api/http";
import { useQuery } from "@/api/query";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import RadioOption from "@/components/ui/RadioOption.vue";
import { useT } from "@/composables/useT";
import { showToast } from "@/composables/useToast";
import type { HwaccelRecommendation } from "@/types/hardware";
import {
  cameraCodecs,
  HWACCEL_AUTO,
  HWACCEL_NONE,
  hwaccelConfig,
  hwaccelParams,
} from "@/utils/setupConfig";
import SetupStep from "./SetupStep.vue";

const props = defineProps<{
  detectorHardwareKey?: string;
  /** camera name to detect stream codec, the only stream hwaccel applies to */
  detectCodecs: Record<string, string>;
}>();
const emit = defineEmits<{ back: []; skip: []; next: [saved: boolean] }>();

const { t } = useT(["views/setup"]);
const cameras = computed(() => cameraCodecs(props.detectCodecs));
const {
  data: recommendation,
  error: recommendError,
  isLoading,
} = useQuery<HwaccelRecommendation>(
  () =>
    [
      "hardware/hwaccel",
      hwaccelParams(props.detectorHardwareKey, cameras.value),
    ] as const,
  { revalidateOnFocus: false },
);

const selected = shallowRef(HWACCEL_AUTO);
const saving = shallowRef(false);
const families = computed(() => recommendation.value?.available ?? []);
const familyLabel = (key: string) => t(`setupWizard.hwaccel.families.${key}`);
const autoDescription = computed(() => {
  const recommended = recommendation.value?.recommended;
  if (recommended) {
    return t("setupWizard.hwaccel.autoResolved", {
      family: familyLabel(recommended),
    });
  }
  return recommendError.value
    ? t("setupWizard.hwaccel.recommendFailed")
    : t("setupWizard.hwaccel.autoNone");
});

async function save() {
  const config = hwaccelConfig(
    selected.value,
    recommendation.value,
    cameras.value,
  );
  // nothing to write leaves the config default of "auto" in place
  if (!config) {
    emit("next", false);
    return;
  }
  saving.value = true;
  try {
    await http.put("config/set", { config_data: config, requires_restart: 1 });
    emit("next", true);
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
    <p>{{ t("setupWizard.hwaccel.detecting") }}</p>
  </div>
  <SetupStep
    v-else
    :title="t('setupWizard.hwaccel.title')"
    :description="t('setupWizard.hwaccel.description')"
    can-skip
    :busy="saving"
    @back="$emit('back')"
    @skip="$emit('skip')"
    @next="save"
  >
    <div class="setup-options" role="radiogroup">
      <RadioOption
        v-model="selected"
        name="setup-hwaccel"
        :value="HWACCEL_AUTO"
        :label="t('setupWizard.hwaccel.auto')"
        :description="autoDescription"
      />
      <RadioOption
        v-for="family in families"
        :key="family.key"
        v-model="selected"
        name="setup-hwaccel"
        :value="family.key"
        :label="familyLabel(family.key)"
      />
      <RadioOption
        v-model="selected"
        name="setup-hwaccel"
        :value="HWACCEL_NONE"
        :label="t('setupWizard.hwaccel.families.none')"
      />
    </div>
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
</style>
