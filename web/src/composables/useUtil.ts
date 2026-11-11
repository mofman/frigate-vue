/** Small browser utilities: clock, persisted refs, fullscreen, media query. */
import { onScopeDispose, readonly, shallowRef, watch, type Ref } from "vue";

// one shared ticking clock per interval so 20 tiles don't own 20 timers
const clocks = new Map<
  number,
  { now: Ref<number>; users: number; timer: ReturnType<typeof setInterval> }
>();

/** Unix seconds, updated every `interval` ms. */
export function useNow(interval = 1000) {
  let clock = clocks.get(interval);
  if (!clock) {
    const now = shallowRef(Date.now() / 1000);
    const timer = setInterval(() => (now.value = Date.now() / 1000), interval);
    clock = { now, users: 0, timer };
    clocks.set(interval, clock);
  }
  clock.users++;
  const current = clock;
  onScopeDispose(() => {
    current.users--;
    if (current.users === 0) {
      clearInterval(current.timer);
      clocks.delete(interval);
    }
  });
  return readonly(current.now);
}

/** A ref mirrored to localStorage. Storage failures fall back to memory. */
export function usePersistedRef<T>(key: string, initial: T): Ref<T> {
  let start = initial;
  try {
    const raw = localStorage.getItem(`frigate:${key}`);
    if (raw !== null) start = JSON.parse(raw) as T;
  } catch {
    // storage blocked or corrupt value
  }
  const value = shallowRef<T>(start) as Ref<T>;
  watch(value, (next) => {
    try {
      localStorage.setItem(`frigate:${key}`, JSON.stringify(next));
    } catch {
      // storage blocked
    }
  });
  return value;
}

export function useFullscreen(target: Ref<HTMLElement | null | undefined>) {
  const isFullscreen = shallowRef(!!document.fullscreenElement);
  const supported = !!document.documentElement.requestFullscreen;
  const onChange = () => (isFullscreen.value = !!document.fullscreenElement);
  document.addEventListener("fullscreenchange", onChange);
  onScopeDispose(() =>
    document.removeEventListener("fullscreenchange", onChange),
  );

  const toggle = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await (target.value ?? document.documentElement).requestFullscreen();
    }
  };

  return { isFullscreen, supported, toggle };
}

export function useMediaQuery(query: string) {
  const list = window.matchMedia(query);
  const matches = shallowRef(list.matches);
  const onChange = (event: MediaQueryListEvent) =>
    (matches.value = event.matches);
  list.addEventListener("change", onChange);
  onScopeDispose(() => list.removeEventListener("change", onChange));
  return readonly(matches);
}

/** Observe an element's content box size. */
export function useElementSize(target: Ref<HTMLElement | null | undefined>) {
  const width = shallowRef(0);
  const height = shallowRef(0);
  const observer = new ResizeObserver(([entry]) => {
    if (!entry) return;
    width.value = entry.contentRect.width;
    height.value = entry.contentRect.height;
  });
  watch(
    target,
    (el, previous) => {
      if (previous) observer.unobserve(previous);
      if (el) observer.observe(el);
    },
    { immediate: true },
  );
  onScopeDispose(() => observer.disconnect());
  return { width, height };
}
