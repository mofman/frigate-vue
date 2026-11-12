/** Small browser utilities: clock, persisted refs, fullscreen, media query. */
import {
  onScopeDispose,
  readonly,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

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

type WebkitVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/**
 * Element fullscreen. iPhone Safari has no element fullscreen, only the native
 * video player's, so pass `video` to fall back to that where it is missing.
 */
export function useFullscreen(
  target: Ref<HTMLElement | null | undefined>,
  video?: () => HTMLVideoElement | undefined,
) {
  const isFullscreen = shallowRef(!!document.fullscreenElement);
  const native = !!document.documentElement.requestFullscreen;
  const supported =
    native ||
    (!!video && "webkitEnterFullscreen" in HTMLVideoElement.prototype);
  const onChange = () => (isFullscreen.value = !!document.fullscreenElement);
  document.addEventListener("fullscreenchange", onChange);
  onScopeDispose(() =>
    document.removeEventListener("fullscreenchange", onChange),
  );

  const toggle = async () => {
    if (!native) {
      (video?.() as WebkitVideo | undefined)?.webkitEnterFullscreen?.();
    } else if (document.fullscreenElement) {
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

/** Sets the tab title while the calling component is mounted. */
export function useDocumentTitle(title: MaybeRefOrGetter<string>) {
  const previous = document.title;
  watch(
    () => toValue(title),
    (value) => {
      if (value) document.title = value;
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    document.title = previous;
  });
}

/** Save text as a file through a temporary object URL. */
export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
