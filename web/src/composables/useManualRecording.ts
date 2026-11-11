/**
 * "Record now": an on demand event that keeps recording until stopped.
 *
 * The event is ended when the user stops it, switches camera or leaves the
 * page, so a forgotten tab never records forever.
 */
import {
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { http } from "@/api/http";

type CreateResponse = { success: boolean; event_id?: string };

export function useManualRecording(camera: MaybeRefOrGetter<string>) {
  const eventId = shallowRef<string>();
  const busy = shallowRef(false);

  async function start() {
    if (eventId.value || busy.value) return;
    busy.value = true;
    try {
      const response = await http.post<CreateResponse>(
        `events/${encodeURIComponent(toValue(camera))}/on_demand/create`,
        { include_recording: true, duration: null },
      );
      if (response.success && response.event_id)
        eventId.value = response.event_id;
    } catch {
      // the button simply stays idle, nothing was started
    } finally {
      busy.value = false;
    }
  }

  function stop() {
    const id = eventId.value;
    if (!id) return;
    eventId.value = undefined;
    void http
      .put(`events/${id}/end`, { end_time: Math.ceil(Date.now() / 1000) })
      .catch(() => undefined);
  }

  function toggle() {
    if (eventId.value) stop();
    else void start();
  }

  watch(() => toValue(camera), stop);
  onScopeDispose(stop);

  return { eventId, busy, start, stop, toggle };
}
