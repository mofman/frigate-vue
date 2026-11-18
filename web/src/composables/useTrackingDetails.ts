/** Timeline and full record for the tracked object being inspected. */
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@/api/query";
import type { TimelineEntry, TrackedEvent } from "@/types/event";

const OPTIONS = { staleTime: 30_000, revalidateOnFocus: false };

export function useTrackingDetails(id: MaybeRefOrGetter<string>) {
  const {
    data: timelineData,
    error,
    isLoading,
  } = useQuery<TimelineEntry[]>(
    () => ["timeline", { source_id: toValue(id), limit: 1000 }],
    OPTIONS,
  );

  // list results can carry a reduced `data`, the path needs the full record
  const { data: events } = useQuery<TrackedEvent[]>(
    () => ["event_ids", { ids: toValue(id) }],
    OPTIONS,
  );

  const timeline = computed(() =>
    [...(timelineData.value ?? [])].sort((a, b) => a.timestamp - b.timestamp),
  );
  const fullEvent = computed(() =>
    events.value?.find((event) => event.id === toValue(id)),
  );

  return { timeline, fullEvent, error, isLoading };
}
