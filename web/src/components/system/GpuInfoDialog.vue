<script setup lang="ts">
/** Output of vainfo (Intel / AMD) or nvidia-smi, fetched when opened. */
import { computed } from "vue";
import { useQuery } from "@/api/query";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";
import type { GpuInfoKind, Nvinfo, Vainfo } from "@/types/stats";
import AppDialog from "@/components/ui/AppDialog.vue";
import AppButton from "@/components/ui/AppButton.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";

const props = defineProps<{ kind: GpuInfoKind }>();
const open = defineModel<boolean>("open", { required: true });
const { t } = useT(["views/system", "common"]);

const { data } = useQuery<Vainfo | Nvinfo>(
  () => (open.value ? props.kind : null),
  { revalidateOnFocus: false },
);

const title = computed(() =>
  props.kind === "vainfo"
    ? t("general.hardwareInfo.gpuInfo.vainfoOutput.title")
    : t("general.hardwareInfo.gpuInfo.nvidiaSMIOutput.title"),
);

const vainfo = computed(() =>
  props.kind === "vainfo" ? (data.value as Vainfo | undefined) : undefined,
);
const nvidia = computed(() =>
  props.kind === "nvinfo"
    ? Object.values((data.value as Nvinfo | undefined) ?? {})
    : [],
);

const text = computed(() => {
  if (vainfo.value) {
    const output =
      vainfo.value.return_code === 0
        ? vainfo.value.stdout
        : vainfo.value.stderr;
    return [
      t("general.hardwareInfo.gpuInfo.vainfoOutput.returnCode", {
        code: vainfo.value.return_code,
      }),
      vainfo.value.return_code === 0
        ? t("general.hardwareInfo.gpuInfo.vainfoOutput.processOutput")
        : t("general.hardwareInfo.gpuInfo.vainfoOutput.processError"),
      output,
    ].join("\n\n");
  }
  return nvidia.value
    .map((gpu) =>
      [
        t("general.hardwareInfo.gpuInfo.nvidiaSMIOutput.name", {
          name: gpu.name,
        }),
        t("general.hardwareInfo.gpuInfo.nvidiaSMIOutput.driver", {
          driver: gpu.driver,
        }),
        t(
          "general.hardwareInfo.gpuInfo.nvidiaSMIOutput.cudaComputerCapability",
          {
            cuda_compute: gpu.cuda_compute,
          },
        ),
        t("general.hardwareInfo.gpuInfo.nvidiaSMIOutput.vbios", {
          vbios: gpu.vbios,
        }),
      ].join("\n"),
    )
    .join("\n\n");
});

async function copy() {
  try {
    await navigator.clipboard.writeText(text.value);
    showToast(t("general.hardwareInfo.gpuInfo.toast.success"), "success");
  } catch {
    // clipboard access is refused outside secure contexts
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="title" width="560px">
    <pre v-if="data" class="gpu-info">{{ text }}</pre>
    <div v-else class="gpu-info__loading"><LoadingSpinner /></div>
    <template #actions>
      <AppButton @click="open = false">{{
        t("common:button.close")
      }}</AppButton>
      <AppButton variant="primary" :disabled="!data" @click="copy">
        {{ t("common:button.copy") }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.gpu-info {
  max-block-size: 24rem;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--text-secondary);
}

.gpu-info__loading {
  display: grid;
  place-items: center;
  min-block-size: 120px;
}
</style>
