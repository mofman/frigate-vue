<script setup lang="ts">
/** ffprobe of each of a camera's inputs: codec, resolution and frame rate. */
import { computed, shallowRef, watch } from "vue";
import { errorMessage, http } from "@/api/http";
import { cameraLabel, useCamera } from "@/composables/useFrigate";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";
import type { Ffprobe, FfprobeStream } from "@/types/stats";
import AppDialog from "@/components/ui/AppDialog.vue";
import AppButton from "@/components/ui/AppButton.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";

const props = defineProps<{ camera: string }>();
const open = defineModel<boolean>("open", { required: true });
const { t } = useT(["views/system", "common"]);
const config = useCamera(() => props.camera);

const probes = shallowRef<Ffprobe[]>();
const failed = shallowRef("");

watch(
  [open, () => props.camera],
  async ([isOpen, camera]) => {
    if (!isOpen) return;
    probes.value = undefined;
    failed.value = "";
    try {
      probes.value = await http.get<Ffprobe[]>("ffprobe", {
        params: { paths: `camera:${camera}` },
      });
    } catch (err) {
      failed.value = errorMessage(err);
    }
  },
  { immediate: true },
);

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function fps(stream: FfprobeStream) {
  const [num, den] = (stream.avg_frame_rate ?? "").split("/").map(Number);
  return num && den ? Math.round((num / den) * 100) / 100 : undefined;
}

function aspect(stream: FfprobeStream) {
  if (!stream.width || !stream.height) return undefined;
  const divisor = gcd(stream.width, stream.height);
  return `${stream.width / divisor}:${stream.height / divisor}`;
}

const inputs = computed(() =>
  (probes.value ?? []).map((probe) => {
    const streams =
      typeof probe.stdout === "object" ? (probe.stdout.streams ?? []) : [];
    return {
      ok: probe.return_code === 0,
      error: probe.stderr,
      video: streams.filter((s) => s.codec_type !== "audio" && s.width),
      audio: streams.filter((s) => s.codec_type === "audio"),
    };
  }),
);

async function copy() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(probes.value, null, 2));
    showToast(t("cameras.toast.success.copyToClipboard"), "success");
  } catch {
    // clipboard access is refused outside secure contexts
  }
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="
      t('cameras.info.cameraProbeInfo', { camera: cameraLabel(config, camera) })
    "
    width="520px"
  >
    <p class="probe__hint">{{ t("cameras.info.tips.title") }} · ffprobe</p>
    <p v-if="failed" class="probe__error">
      {{ t("cameras.info.error", { error: failed }) }}
    </p>
    <div v-else-if="!probes" class="probe__loading">
      <LoadingSpinner />
      <span>{{ t("cameras.info.fetching") }}</span>
    </div>
    <section v-for="(input, index) in inputs" :key="index" class="probe__input">
      <h3>{{ t("cameras.info.stream", { idx: index + 1 }) }}</h3>
      <p v-if="!input.ok" class="probe__error">
        {{ t("cameras.info.error", { error: input.error }) }}
      </p>
      <dl v-for="(video, v) in input.video" :key="`v${v}`">
        <dt class="probe__kind">{{ t("cameras.info.video") }}</dt>
        <dt>{{ t("cameras.info.codec") }}</dt>
        <dd>{{ video.codec_long_name ?? t("cameras.info.unknown") }}</dd>
        <dt>{{ t("cameras.info.resolution") }}</dt>
        <dd>
          {{ video.width }}x{{ video.height }}
          <span v-if="aspect(video)" class="probe__muted">
            ({{ aspect(video) }} {{ t("cameras.info.aspectRatio") }})</span
          >
        </dd>
        <dt>{{ t("cameras.info.fps") }}</dt>
        <dd>{{ fps(video) ?? t("cameras.info.unknown") }}</dd>
      </dl>
      <dl v-for="(audio, a) in input.audio" :key="`a${a}`">
        <dt class="probe__kind">{{ t("cameras.info.audio") }}</dt>
        <dt>{{ t("cameras.info.codec") }}</dt>
        <dd>{{ audio.codec_long_name ?? t("cameras.info.unknown") }}</dd>
      </dl>
    </section>
    <template #actions>
      <AppButton @click="open = false">{{
        t("common:button.close")
      }}</AppButton>
      <AppButton variant="primary" :disabled="!probes" @click="copy">
        {{ t("common:button.copy") }}
      </AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.probe__hint {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.probe__loading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--text-md);
  color: var(--text-secondary);
}

.probe__error {
  font-size: var(--text-md);
  color: var(--danger);
  overflow-wrap: anywhere;
}

.probe__input {
  display: grid;
  gap: 8px;

  h3 {
    padding: 6px 10px;
    border-radius: var(--radius-xs);
    background: var(--bg-surface);
    font-size: var(--text-md);
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 12px;
    padding-inline: 10px;
    font-size: var(--text-md);
  }

  dt {
    color: var(--text-tertiary);
  }

  dd {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--text-primary);
  }
}

.probe__kind {
  grid-column: 1 / -1;
  font-weight: 600;
  color: var(--text-secondary);
}

.probe__muted {
  color: var(--text-tertiary);
}
</style>
