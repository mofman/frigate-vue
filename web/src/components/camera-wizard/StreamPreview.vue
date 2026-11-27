<script setup lang="ts">
/**
 * Live preview of a stream that is not in the config yet. A temporary go2rtc
 * stream carries it, and is removed again when the preview goes away so camera
 * credentials do not linger there.
 */
import { computed, onBeforeUnmount, shallowRef, watch, watchEffect } from "vue";
import { RotateCcw } from "@lucide/vue";
import { http } from "@/api/http";
import AppButton from "@/components/ui/AppButton.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import { useT } from "@/composables/useT";
import { leaseLive, type Lease } from "@/players/pool";
import type { LiveSession } from "@/players/session";
import type { StreamConfig } from "@/types/cameraWizard";

// go2rtc needs a moment before a new stream can be consumed
const REGISTER_DELAY_MS = 500;

const props = defineProps<{ stream: StreamConfig }>();
const emit = defineEmits<{ registered: [go2rtcStream: string] }>();

const { t } = useT(["views/settings"]);
const container = shallowRef<HTMLElement | null>(null);
const session = shallowRef<LiveSession>();
const failed = shallowRef(false);
let streamId: string | undefined;
let lease: Lease | undefined;
let delay: ReturnType<typeof setTimeout> | undefined;

const aspectRatio = computed(() => {
  const [width, height] = (props.stream.testResult?.resolution ?? "")
    .split("x")
    .map(Number);
  return width > 0 && height > 0 ? `${width} / ${height}` : "16 / 9";
});

function removeStream(id: string) {
  void http
    .delete(`go2rtc/streams/${encodeURIComponent(id)}`)
    .catch(() => undefined);
}

function stop() {
  clearTimeout(delay);
  lease?.release(0);
  lease = undefined;
  session.value = undefined;
  if (streamId) removeStream(streamId);
  streamId = undefined;
}

async function start() {
  stop();
  failed.value = false;
  const id = `wizard_${props.stream.id}_${Date.now()}`;
  streamId = id;
  const src = props.stream.useFfmpeg
    ? `ffmpeg:${props.stream.url}`
    : props.stream.url;
  try {
    await http.put(`go2rtc/streams/${encodeURIComponent(id)}`, undefined, {
      params: { src },
    });
  } catch {
    if (streamId === id) failed.value = true;
    return;
  }
  // stopped while registering: the earlier delete may have arrived first
  if (streamId !== id) {
    removeStream(id);
    return;
  }
  delay = setTimeout(() => {
    lease = leaseLive({ mode: "mse", stream: id, camera: id });
    session.value = lease.session;
    lease.session.setMuted(true);
    lease.session.resume();
    emit("registered", id);
  }, REGISTER_DELAY_MS);
}

// separate sources, so a new probe result alone does not reconnect the preview
watch([() => props.stream.url, () => props.stream.useFfmpeg], start, {
  immediate: true,
});

watchEffect(() => {
  const element = session.value?.element;
  if (element && container.value && element.parentElement !== container.value) {
    container.value.appendChild(element);
  }
});

watch(
  () => session.value?.status.value,
  (status) => {
    if (status === "error") failed.value = true;
  },
);

onBeforeUnmount(stop);
</script>

<template>
  <div class="stream-preview" :style="{ aspectRatio }">
    <div v-if="failed" class="stream-preview__state">
      <span>{{ t("cameraWizard.step4.streamUnavailable") }}</span>
      <AppButton size="sm" @click="start">
        <template #icon><RotateCcw /></template>
        {{ t("cameraWizard.step4.reload") }}
      </AppButton>
    </div>
    <template v-else>
      <div ref="container" class="stream-preview__media" />
      <div
        v-if="session?.status.value !== 'playing'"
        class="stream-preview__state"
      >
        <LoadingSpinner :size="16" :delay="0" />
        <span>{{ t("cameraWizard.step4.connecting") }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stream-preview {
  position: relative;
  inline-size: 100%;
  max-block-size: 30dvh;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--bg-media);
}

.stream-preview__media {
  position: absolute;
  inset: 0;
}

.stream-preview__media :deep(.live-media) {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}

.stream-preview__state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: var(--text-sm);
  color: var(--text-on-media-muted);
}
</style>
