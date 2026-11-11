/**
 * Motion activity and recording gaps for the timeline, fetched in hourly
 * buckets.
 *
 * Past hours never change, so they are fetched once and cached for the
 * session. Only the current hour refreshes. Scrolling the timeline or the
 * clock advancing never refetches or blanks what is already drawn.
 */
import {
  onScopeDispose,
  shallowRef,
  toValue,
  triggerRef,
  watch,
  type MaybeRefOrGetter,
} from "vue";
import { http } from "@/api/http";
import type { MotionData, UnavailableRange } from "@/types/frigate";

const HOUR = 3600;
const CURRENT_HOUR_REFRESH = 30_000;

type Bucket = {
  motion: MotionData[];
  unavailable: UnavailableRange[];
  fetchedAt: number;
};

const cache = new Map<string, Bucket>();
const inflight = new Map<string, Promise<Bucket>>();

function bucketKey(camera: string, hour: number, scale: number) {
  return `${camera}|${hour}|${scale}`;
}

async function fetchBucket(
  camera: string,
  hour: number,
  scale: number,
): Promise<Bucket> {
  const key = bucketKey(camera, hour, scale);
  const existing = inflight.get(key);
  if (existing) return existing;

  const params = { cameras: camera, after: hour, before: hour + HOUR, scale };
  const promise = Promise.all([
    http
      .get<MotionData[]>("review/activity/motion", { params })
      .catch(() => [] as MotionData[]),
    http
      .get<UnavailableRange[]>("recordings/unavailable", { params })
      .catch(() => [] as UnavailableRange[]),
  ])
    .then(([motion, unavailable]) => {
      const bucket = { motion, unavailable, fetchedAt: Date.now() };
      cache.set(key, bucket);
      return bucket;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

export function useTimelineData(
  camera: MaybeRefOrGetter<string>,
  range: MaybeRefOrGetter<{ after: number; before: number }>,
  scale: MaybeRefOrGetter<number>,
) {
  /** bumps whenever any bucket lands, consumers read buckets() after */
  const version = shallowRef(0);
  const hours = shallowRef<number[]>([]);

  const load = (force = false) => {
    const cam = toValue(camera);
    const { after, before } = toValue(range);
    const sc = toValue(scale);
    const now = Date.now() / 1000;
    const currentHour = Math.floor(now / HOUR) * HOUR;
    const list: number[] = [];

    for (
      let hour = Math.floor(after / HOUR) * HOUR;
      hour < before;
      hour += HOUR
    ) {
      if (hour > now) break;
      list.push(hour);
      const cached = cache.get(bucketKey(cam, hour, sc));
      const stale =
        hour >= currentHour - HOUR &&
        (!cached || Date.now() - cached.fetchedAt > CURRENT_HOUR_REFRESH);
      if (!cached || stale || (force && hour === currentHour)) {
        void fetchBucket(cam, hour, sc).then(() => {
          version.value++;
        });
      }
    }
    hours.value = list;
    triggerRef(version);
  };

  watch(
    () => {
      const r = toValue(range);
      // only re-run when the visible hour set changes, not on every scroll
      return `${toValue(camera)}|${Math.floor(r.after / HOUR)}|${Math.floor(r.before / HOUR)}|${toValue(scale)}`;
    },
    () => load(),
    { immediate: true },
  );

  const timer = setInterval(() => {
    if (document.visibilityState === "visible") load(true);
  }, CURRENT_HOUR_REFRESH);
  onScopeDispose(() => clearInterval(timer));

  /** All loaded buckets for the current hours, newest data first. */
  function buckets(): Bucket[] {
    void version.value;
    const cam = toValue(camera);
    const sc = toValue(scale);
    return hours.value
      .map((hour) => cache.get(bucketKey(cam, hour, sc)))
      .filter((b): b is Bucket => !!b);
  }

  return { version, buckets, reload: () => load(true) };
}
