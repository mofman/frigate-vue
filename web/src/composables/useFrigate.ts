/** Shared data composables for config, auth, stats and camera ordering. */
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@/api/query";
import { useWsTopic } from "@/api/ws";
import type {
  CameraConfig,
  FrigateConfig,
  FrigateStats,
  UserProfile,
} from "@/types/frigate";

export function useConfig() {
  return useQuery<FrigateConfig>("config", {
    staleTime: 60_000,
    revalidateOnFocus: false,
  });
}

export function useProfile() {
  return useQuery<UserProfile>("profile", {
    staleTime: 60_000,
    revalidateOnFocus: false,
  });
}

/** True when the signed in user has the admin role. */
export function useIsAdmin() {
  const { data: profile } = useProfile();
  return computed(() => profile.value?.role === "admin");
}

/** Cameras the current user may view, sorted by ui.order. */
export function useCameras() {
  const { data: config } = useConfig();
  const { data: profile } = useProfile();

  return computed<CameraConfig[]>(() => {
    if (!config.value) return [];
    const allowed = profile.value?.allowed_cameras;
    return Object.values(config.value.cameras)
      .filter((camera) => camera.enabled_in_config)
      .filter((camera) => !allowed || allowed.includes(camera.name))
      .sort((a, b) => a.ui.order - b.ui.order);
  });
}

export function useCamera(name: MaybeRefOrGetter<string | undefined>) {
  const { data: config } = useConfig();
  return computed(() => {
    const camera = toValue(name);
    return camera ? config.value?.cameras[camera] : undefined;
  });
}

export function cameraLabel(camera: CameraConfig | undefined, fallback = "") {
  if (!camera) return fallback;
  return camera.friendly_name || camera.name.replaceAll("_", " ");
}

/** Stats from the REST endpoint, then kept fresh by the ws stats topic. */
export function useStats() {
  const { data: polled } = useQuery<FrigateStats>("stats", {
    staleTime: 10_000,
  });
  const live = useWsTopic<FrigateStats>("stats");
  return computed(() => live.value ?? polled.value);
}

export function isCameraOffline(
  stats: FrigateStats | undefined,
  camera: string,
) {
  if (!stats?.cameras) return false;
  return stats.cameras[camera]?.camera_fps === 0 && stats.service.uptime > 60;
}
