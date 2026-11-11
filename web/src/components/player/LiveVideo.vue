<script setup lang="ts">
/**
 * Live stream layer. Leases a session from the pool, mounts its media
 * element, and walks the transport fallback chain on errors without ever
 * unmounting itself.
 */
import { computed, onBeforeUnmount, shallowRef, watch, watchEffect } from "vue";
import { leaseLive, type Lease } from "@/players/pool";
import type { LiveMode, LiveSession, LiveStatus } from "@/players/session";
import { chooseStream } from "@/players/streams";
import { iceServersFromConfig } from "@/players/webrtc";
import { useConfig } from "@/composables/useFrigate";
import type { CameraConfig } from "@/types/frigate";

const props = withDefaults(
  defineProps<{
    camera: CameraConfig;
    /** open the stream at all; false releases it (with linger) */
    enabled?: boolean;
    /** keep the connection but pause presenting, used while hidden */
    parked?: boolean;
    muted?: boolean;
    preferredStream?: string;
    lowBandwidth?: boolean;
    background?: boolean;
    /** how long the connection survives after release */
    lingerMs?: number;
  }>(),
  {
    enabled: true,
    parked: false,
    muted: true,
    preferredStream: undefined,
    lowBandwidth: false,
    background: false,
    lingerMs: undefined,
  },
);

const emit = defineEmits<{
  /** a frame was presented after connecting or resuming */
  frame: [];
  failed: [];
}>();

const { data: config } = useConfig();
const container = shallowRef<HTMLDivElement | null>(null);
const session = shallowRef<LiveSession>();
const attempt = shallowRef(0);
let lease: Lease | undefined;

const choice = computed(() =>
  config.value
    ? chooseStream(props.camera, config.value, {
        preferredStream: props.preferredStream,
        lowBandwidth: props.lowBandwidth,
      })
    : undefined,
);

const mode = computed<LiveMode | undefined>(
  () => choice.value?.modes[attempt.value],
);

function release() {
  if (!lease) return;
  lease.release(props.lingerMs);
  lease = undefined;
  session.value = undefined;
}

// (re)lease whenever the stream identity changes
watch(
  () =>
    props.enabled && choice.value && mode.value
      ? `${mode.value}|${choice.value.stream}|${props.camera.name}`
      : null,
  (identity) => {
    release();
    if (!identity || !choice.value || !mode.value) return;

    lease = leaseLive({
      mode: mode.value,
      stream: choice.value.stream,
      camera: props.camera.name,
      iceServers: iceServersFromConfig(
        config.value?.go2rtc.webrtc?.ice_servers,
      ),
      background: props.background,
    });
    session.value = lease.session;
  },
  { immediate: true },
);

// a new camera or stream restarts the fallback chain
watch(
  () => `${props.camera.name}|${props.preferredStream}|${props.lowBandwidth}`,
  () => (attempt.value = 0),
);

// mount the leased element into our container
watchEffect(() => {
  const el = container.value;
  const current = session.value;
  if (!el || !current) return;
  if (current.element.parentElement !== el) el.appendChild(current.element);
});

// parked / resumed presentation
watch(
  [session, () => props.parked],
  ([current, parked], [previous]) => {
    if (!current) return;
    if (parked) {
      current.park();
    } else if (current !== previous || current.status.value === "playing") {
      current.resume();
    }
  },
  { immediate: true },
);

watchEffect(() => session.value?.setMuted(props.muted));

watch(
  () => session.value?.firstFrameAt.value,
  (value) => {
    if (value) emit("frame");
  },
);

watch(
  () => session.value?.status.value,
  (status?: LiveStatus) => {
    if (status !== "error" || !choice.value) return;
    if (attempt.value < choice.value.modes.length - 1) {
      attempt.value++;
    } else {
      emit("failed");
    }
  },
);

onBeforeUnmount(release);

const status = computed(() => session.value?.status.value ?? "idle");
const resolution = computed(() => session.value?.resolution.value);

/** The element currently presenting frames, used to capture a hold frame. */
function frameSource(): HTMLVideoElement | HTMLCanvasElement | undefined {
  const el = session.value?.element;
  if (!el) return undefined;
  if (el instanceof HTMLVideoElement) return el;
  return el.querySelector("canvas") ?? undefined;
}

defineExpose({ status, resolution, frameSource, mode });
</script>

<template>
  <div
    ref="container"
    class="live-video"
    :data-mode="mode"
    :data-status="status"
  />
</template>

<style scoped>
.live-video {
  position: absolute;
  inset: 0;
  background: var(--bg-media);
}

/* the leased element is created outside Vue, so it needs :deep */
.live-video :deep(.live-media),
.live-video :deep(.live-media--jsmpeg canvas) {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}
</style>
