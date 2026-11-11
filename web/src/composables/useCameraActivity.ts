/**
 * Live activity for a camera: tracked objects, motion and enabled state.
 *
 * Starts from the camera_activity snapshot and then applies individual
 * object events so labels appear and clear in real time.
 */
import {
  computed,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { onWsMessage, sendWs, useWsTopic } from "@/api/ws";
import { isCameraOffline, useConfig, useStats } from "./useFrigate";
import type {
  FrigateCameraState,
  FrigateEvent,
  ObjectType,
} from "@/types/frigate";

export function useCameraActivity(camera: MaybeRefOrGetter<string>) {
  const { data: config } = useConfig();
  const stats = useStats();
  const objects = shallowRef<ObjectType[]>([]);

  const snapshot = useWsTopic<FrigateCameraState>(
    () => `camera_activity/${toValue(camera)}`,
  );
  const enabledState = useWsTopic<string>(
    () => `${toValue(camera)}/enabled/state`,
  );
  const motionState = useWsTopic<string>(() => `${toValue(camera)}/motion`);

  const attributeLabels = computed(() =>
    Object.values(config.value?.model?.attributes_map ?? {}).flat(),
  );

  watch(
    snapshot,
    (state) => {
      if (state) objects.value = state.objects ?? [];
    },
    { immediate: true },
  );

  onWsMessage<FrigateEvent>("events", (event) => {
    if (!event?.after || event.after.camera !== toValue(camera)) return;
    const current = objects.value;
    const index = current.findIndex((obj) => obj.id === event.after.id);

    if (event.type === "end") {
      if (index !== -1) objects.value = current.filter((_, i) => i !== index);
      return;
    }

    let label = event.after.label;
    const subLabel = event.after.sub_label?.[0];
    if (subLabel) {
      label = attributeLabels.value.includes(subLabel)
        ? subLabel
        : `${label}-verified`;
    }

    if (index === -1) {
      if (event.after.stationary) return;
      objects.value = [
        ...current,
        {
          id: event.after.id,
          label,
          stationary: event.after.stationary,
          area: event.after.area,
          ratio: event.after.ratio,
          score: event.after.score,
          sub_label: subLabel ?? "",
        },
      ];
      return;
    }

    const existing = current[index]!;
    if (
      existing.label === label &&
      existing.stationary === event.after.stationary
    ) {
      return;
    }
    const next = [...current];
    next[index] = { ...existing, label, stationary: event.after.stationary };
    objects.value = next;
  });

  const enabled = computed(() =>
    enabledState.value ? enabledState.value === "ON" : true,
  );
  const activeObjects = computed(() =>
    enabled.value ? objects.value.filter((obj) => !obj.stationary) : [],
  );
  const activeMotion = computed(() => {
    if (!enabled.value) return false;
    if (motionState.value) return motionState.value === "ON";
    return snapshot.value?.motion === true;
  });

  return {
    enabled,
    objects: activeObjects,
    activeMotion,
    activeTracking: computed(() => activeObjects.value.length > 0),
    offline: computed(() => isCameraOffline(stats.value, toValue(camera))),
  };
}

export type CameraFeature =
  | "detect"
  | "recordings"
  | "snapshots"
  | "audio"
  | "audio_transcription"
  | "notifications"
  | "enabled"
  | "ptz_autotracker";

/** A camera feature toggle backed by the ws state/set topic pair. */
export function useFeatureState(
  camera: MaybeRefOrGetter<string>,
  feature: CameraFeature,
) {
  const state = useWsTopic<string>(() => `${toValue(camera)}/${feature}/state`);
  return {
    on: computed(() => state.value === "ON"),
    known: computed(() => state.value !== undefined),
    set: (value: boolean) =>
      sendWs(`${toValue(camera)}/${feature}/set`, value ? "ON" : "OFF"),
  };
}
