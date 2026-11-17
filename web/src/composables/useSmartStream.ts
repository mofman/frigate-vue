/**
 * Smart streaming for camera thumbnails: a live stream is only wanted while
 * the camera has activity (and for a while after), while hovered, or when the
 * caller forces it. Keeps rows and grids of cameras cheap.
 */
import {
  computed,
  onBeforeUnmount,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { useCameraActivity } from "./useCameraActivity";
import { demoMode } from "@/utils/demo";

/** how long the stream keeps running after activity stops */
const SMART_LINGER = 30_000;

export function useSmartStream(
  camera: MaybeRefOrGetter<string>,
  options: {
    /** false never streams, eg while something else shows the camera */
    enabled?: MaybeRefOrGetter<boolean>;
    /** stream regardless of activity */
    force?: MaybeRefOrGetter<boolean>;
  } = {},
) {
  const activity = useCameraActivity(camera);

  const busy = computed(
    () => activity.activeTracking.value || activity.activeMotion.value,
  );

  const recentlyActive = shallowRef(false);
  let lingerTimer: ReturnType<typeof setTimeout> | undefined;
  watch(
    busy,
    (now) => {
      clearTimeout(lingerTimer);
      if (now) recentlyActive.value = true;
      else
        lingerTimer = setTimeout(
          () => (recentlyActive.value = false),
          SMART_LINGER,
        );
    },
    { immediate: true },
  );
  onBeforeUnmount(() => clearTimeout(lingerTimer));

  const hovered = shallowRef(false);
  const streamWanted = computed(
    () =>
      !demoMode &&
      (toValue(options.enabled) ?? true) &&
      activity.enabled.value &&
      !activity.offline.value &&
      (!!toValue(options.force) || recentlyActive.value || hovered.value),
  );

  /** the live layer has painted a frame and can cover the still */
  const liveShown = shallowRef(false);
  watch(streamWanted, (wanted) => {
    if (!wanted) liveShown.value = false;
  });

  return { activity, busy, hovered, streamWanted, liveShown };
}
