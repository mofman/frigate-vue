/**
 * The clip being picked for export in the camera view: a time range chosen
 * on the timeline plus the options from the export bar. The camera view owns
 * one instance and hands it to the timeline and the bar.
 */
import { computed, readonly, shallowRef, toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";
import { http, HttpError } from "@/api/http";
import { invalidate } from "@/api/query";
import { refreshExportJobs } from "@/composables/useExportJobs";
import type { Playback } from "@/composables/usePlayback";
import { showToast } from "@/composables/useToast";
import { useT } from "@/composables/useT";
import { useTimeOptions } from "@/composables/useFrigate";
import type {
  BatchExportResponse,
  ExportStream,
  StartExportResponse,
} from "@/types/export";
import {
  clampRange,
  moveEnd,
  moveStart,
  type ExportRange,
} from "@/utils/exportRange";
import { formatDateTime } from "@/utils/time";

export function useExportSelection(
  camera: MaybeRefOrGetter<string>,
  playback: Playback,
) {
  const { t } = useT(["views/app"]);
  const timeOptions = useTimeOptions();

  const active = shallowRef(false);
  const range = shallowRef<ExportRange>({ start: 0, end: 0 });
  const name = shallowRef("");
  const stream = shallowRef<ExportStream>("auto");
  /** cameras exported alongside the one on stage */
  const extraCameras = shallowRef<string[]>([]);
  /** looping playback between the two edges */
  const previewing = shallowRef(false);
  const busy = shallowRef(false);

  const bounds = () => ({
    earliest: playback.earliest.value,
    now: Date.now() / 1000,
  });

  const cameras = computed(() => {
    const current = toValue(camera);
    return [current, ...extraCameras.value.filter((cam) => cam !== current)];
  });

  function open(initial: ExportRange) {
    range.value = clampRange(initial, bounds());
    if (active.value) return;
    name.value = "";
    extraCameras.value = [];
    previewing.value = false;
    active.value = true;
  }

  function close() {
    active.value = false;
    previewing.value = false;
  }

  function setRange(next: ExportRange) {
    range.value = clampRange(next, bounds());
  }

  function setStart(time: number) {
    range.value = moveStart(range.value, time, bounds());
  }

  function setEnd(time: number) {
    range.value = moveEnd(range.value, time, bounds());
  }

  function setPreviewing(value: boolean) {
    previewing.value = value && active.value;
  }

  function toggleCamera(cam: string) {
    if (cam === toValue(camera)) return;
    extraCameras.value = extraCameras.value.includes(cam)
      ? extraCameras.value.filter((other) => other !== cam)
      : [...extraCameras.value, cam];
  }

  function failed(error: unknown) {
    const detail = error instanceof HttpError ? error.detail : undefined;
    showToast(detail ?? t("export.failed"), "error", 6000);
  }

  async function submit() {
    if (busy.value || !active.value) return;
    busy.value = true;
    const after = Math.floor(range.value.start);
    const before = Math.ceil(range.value.end);
    const friendly = name.value.trim() || undefined;
    const targets = cameras.value;
    const link = { label: t("export.view"), to: "/export" };

    try {
      if (targets.length === 1) {
        await http.post<StartExportResponse>(
          `export/${encodeURIComponent(targets[0]!)}/start/${after}/end/${before}`,
          { source: "recordings", name: friendly, stream: stream.value },
        );
        showToast(t("export.started"), "success", 6000, link);
      } else {
        // several cameras go in as one case so they stay together
        const response = await http.post<BatchExportResponse>("exports/batch", {
          items: targets.map((cam) => ({
            camera: cam,
            start_time: after,
            end_time: before,
            friendly_name: friendly,
          })),
          new_case_name:
            friendly ??
            t("export.caseName", {
              time: formatDateTime(after, timeOptions.value),
            }),
          stream: stream.value,
        });
        const queued = response.export_ids.length;
        if (queued === targets.length) {
          showToast(
            t("export.startedMany", { count: queued }),
            "success",
            6000,
            link,
          );
        } else {
          showToast(
            t("export.startedSome", { queued, total: targets.length }),
            "info",
            8000,
            link,
          );
        }
      }
    } catch (error) {
      failed(error);
      return;
    } finally {
      busy.value = false;
    }

    invalidate("exports");
    invalidate("cases");
    refreshExportJobs();
    close();
  }

  return {
    active: readonly(active),
    range: readonly(range),
    duration: computed(() => range.value.end - range.value.start),
    name: readonly(name),
    stream: readonly(stream),
    extraCameras: readonly(extraCameras),
    cameras,
    previewing: readonly(previewing),
    busy: readonly(busy),
    open,
    close,
    setRange,
    setStart,
    setEnd,
    setName: (value: string) => (name.value = value),
    setStream: (value: ExportStream) => (stream.value = value),
    setPreviewing,
    toggleCamera,
    submit,
  };
}

export type ExportSelection = ReturnType<typeof useExportSelection>;
