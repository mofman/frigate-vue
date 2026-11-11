/** Data for the Health tab: registry notices and the hardware checks. */
import {
  computed,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { http } from "@/api/http";
import { invalidate, useQuery } from "@/api/query";
import { useWsTopic } from "@/api/ws";
import { cameraLabel, useConfig, useStats } from "@/composables/useFrigate";
import { useT } from "@/composables/useT";
import type {
  DetectionHardware,
  HwaccelRecommendation,
  Notice,
} from "@/types/health";
import {
  cameraConnectionCells,
  detectionRows,
  enrichmentRows,
  hwaccelRows,
  isStartupWindow,
} from "@/utils/health";

/** When a hidden notice was acknowledged or muted. */
export function hiddenAt(notice: Notice): number {
  return notice.muted_at ?? notice.acknowledged_at ?? 0;
}

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const;

/** Most severe first, then most recent. */
export function sortNotices(notices: Notice[]): Notice[] {
  return [...notices].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.last_seen - a.last_seen,
  );
}

/**
 * Active notices come from a REST snapshot, then from every `notices`
 * websocket frame. Hidden ones are fetched only while they are shown.
 */
export function useNotices(showHidden: MaybeRefOrGetter<boolean>) {
  const { data: initial, refresh } = useQuery<Notice[]>("notices", {
    revalidateOnFocus: false,
  });
  const { data: all, refresh: refreshAll } = useQuery<Notice[]>(() =>
    toValue(showHidden) ? ["notices", { include_hidden: true }] : null,
  );
  const live = useWsTopic<Notice[]>("notices");

  // once a frame has arrived it is the source of truth; every acknowledge,
  // mute and unhide publishes a new one
  const notices = computed(() => {
    const list = Array.isArray(live.value) ? live.value : initial.value;
    return list ? sortNotices(list) : undefined;
  });

  watch(live, () => {
    if (toValue(showHidden)) void refreshAll();
  });

  const hidden = computed(() =>
    all.value
      ?.filter((notice) => hiddenAt(notice) > 0)
      .sort((a, b) => hiddenAt(b) - hiddenAt(a)),
  );

  async function act(request: Promise<unknown>) {
    await request;
    await Promise.all([refresh(), toValue(showHidden) ? refreshAll() : null]);
  }

  return {
    notices,
    hidden,
    acknowledge: (id: string) =>
      act(http.post(`notices/${encodeURIComponent(id)}/acknowledge`)),
    mute: (id: string) =>
      act(http.post(`notices/${encodeURIComponent(id)}/mute`)),
    unhide: (id: string) =>
      act(http.delete(`notices/${encodeURIComponent(id)}/hidden`)),
    unhideAll: () => act(http.delete("notices/hidden")),
  };
}

/** Rows of the hardware pane, recomputed as stats arrive. */
export function useHardwareHealth() {
  const { t } = useT(["views/system", "views/setup", "views/settings"]);
  const { data: config } = useConfig();
  const stats = useStats();
  const { data: hardware, error: probeError } = useQuery<DetectionHardware[]>(
    "hardware/probe",
    { revalidateOnFocus: false, staleTime: 60_000 },
  );
  const { data: hwaccel, error: hwaccelError } =
    useQuery<HwaccelRecommendation>("hardware/hwaccel", {
      revalidateOnFocus: false,
      staleTime: 60_000,
    });

  const rechecking = shallowRef(false);
  const probedAt = shallowRef<number>();

  async function recheck() {
    if (rechecking.value) return;
    rechecking.value = true;
    try {
      await http.get("hardware/probe", { params: { refresh: true } });
      invalidate("hardware/");
      probedAt.value = Date.now() / 1000;
    } catch {
      // the pane keeps showing the last probe
    } finally {
      rechecking.value = false;
    }
  }

  const rows = computed(() => {
    if (!config.value) return undefined;
    const startup = isStartupWindow(stats.value);
    const cameraName = (name: string) =>
      cameraLabel(config.value?.cameras[name], name);
    return {
      detection: detectionRows({
        models: config.value.models ?? [],
        hardware: hardware.value,
        probeFailed: !!probeError.value,
        stats: stats.value,
        startup,
        t,
      }),
      hwaccel: hwaccelRows({
        config: config.value,
        hwaccel: hwaccel.value,
        hwaccelFailed: !!hwaccelError.value,
        stats: stats.value,
        t,
        cameraName,
      }),
      enrichments: enrichmentRows({
        config: config.value,
        hardware: hardware.value,
        probeFailed: !!probeError.value,
        stats: stats.value,
        startup,
        t,
      }),
      cameras: cameraConnectionCells(config.value, stats.value).map((cell) => ({
        ...cell,
        label: cameraName(cell.camera),
      })),
    };
  });

  return { rows, rechecking, probedAt, recheck };
}
