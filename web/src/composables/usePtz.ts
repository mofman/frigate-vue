/** PTZ capabilities and commands for an ONVIF camera. */
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@/api/query";
import { sendWs } from "@/api/ws";
import type { CameraConfig } from "@/types/frigate";

export type PtzInfo = {
  name: string;
  features: string[];
  presets: string[];
};

export function usePtz(camera: MaybeRefOrGetter<CameraConfig | undefined>) {
  const { data: info } = useQuery<PtzInfo>(
    () => {
      const cam = toValue(camera);
      return cam?.onvif?.host
        ? `${encodeURIComponent(cam.name)}/ptz/info`
        : null;
    },
    { staleTime: 5 * 60_000, revalidateOnFocus: false },
  );

  const current = computed(() => {
    const cam = toValue(camera);
    // the cached info may still be the previous camera's during a switch
    return cam?.onvif?.host && info.value?.name === cam.name
      ? info.value
      : undefined;
  });
  const features = computed(() => current.value?.features ?? []);
  const has = (feature: string) => features.value.includes(feature);

  return {
    available: computed(() => features.value.length > 0),
    canMove: computed(() => has("pt")),
    canZoom: computed(() => has("zoom")),
    canFocus: computed(() => has("focus")),
    canClickMove: computed(() => has("pt-r-fov")),
    canBoxZoom: computed(() => has("zoom-r")),
    presets: computed(() => current.value?.presets ?? []),
    send(command: string) {
      const cam = toValue(camera);
      if (cam) sendWs(`${cam.name}/ptz`, command);
    },
  };
}

export type Ptz = ReturnType<typeof usePtz>;
