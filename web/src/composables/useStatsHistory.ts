/**
 * A rolling window of stats snapshots for the System charts: seeded from
 * /stats/history, then one point per `stats` websocket frame. Only the keys
 * a tab charts are requested, which keeps the history payload small.
 */
import {
  computed,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { useQuery } from "@/api/query";
import { onWsMessage } from "@/api/ws";
import type { FrigateStats } from "@/types/stats";
import { appendSnapshot } from "@/utils/stats";

export function useStatsHistory(
  keys: string,
  active: MaybeRefOrGetter<boolean> = true,
) {
  const { data, refresh, isLoading } = useQuery<FrigateStats[]>(
    ["stats/history", { keys }],
    { revalidateOnFocus: false, staleTime: 0 },
  );
  const history = shallowRef<FrigateStats[]>([]);

  watch(
    data,
    (value) => {
      if (value?.length) history.value = value;
    },
    { immediate: true },
  );

  onWsMessage<FrigateStats>("stats", (stats) => {
    if (!toValue(active) || typeof stats !== "object" || !stats?.service) {
      return;
    }
    history.value = appendSnapshot(history.value, stats);
  });

  // a hidden tab misses frames, so catch up when it is shown again
  watch(
    () => toValue(active),
    (now, before) => {
      if (now && before === false) void refresh();
    },
  );

  const times = computed(() =>
    history.value.map((stats) => stats.service.last_updated),
  );
  const lastUpdated = computed(() => times.value.at(-1));

  return { history, times, lastUpdated, isLoading };
}
