<script setup lang="ts">
/** Detect / record / snapshot toggles backed by the ws state topics. */
import { CircleDot, ScanEye, Camera } from "@lucide/vue";
import OverlayButton from "@/components/ui/OverlayButton.vue";
import { useFeatureState } from "@/composables/useCameraActivity";
import { useT } from "@/composables/useT";

const props = defineProps<{ camera: string }>();
const { t } = useT(["views/app"]);

const detect = useFeatureState(() => props.camera, "detect");
const recordings = useFeatureState(() => props.camera, "recordings");
const snapshots = useFeatureState(() => props.camera, "snapshots");
</script>

<template>
  <OverlayButton
    :label="detect.on.value ? t('features.detectOn') : t('features.detectOff')"
    :active="detect.on.value"
    @click="detect.set(!detect.on.value)"
  >
    <ScanEye />
  </OverlayButton>
  <OverlayButton
    :label="
      recordings.on.value ? t('features.recordOn') : t('features.recordOff')
    "
    :active="recordings.on.value"
    tone="danger"
    @click="recordings.set(!recordings.on.value)"
  >
    <CircleDot />
  </OverlayButton>
  <OverlayButton
    :label="
      snapshots.on.value
        ? t('features.snapshotsOn')
        : t('features.snapshotsOff')
    "
    :active="snapshots.on.value"
    @click="snapshots.set(!snapshots.on.value)"
  >
    <Camera />
  </OverlayButton>
</template>
