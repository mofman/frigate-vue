/**
 * Wheel, pinch and drag zoom for the camera stage. Zooms toward the cursor
 * (or the pinch centre), pans by dragging once zoomed, and never lets the
 * picture leave the frame. Double click toggles between fit and 2x.
 */
import {
  computed,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

const MAX_SCALE = 8;
/** pointer targets that keep their own drag and click behaviour */
const INTERACTIVE = "button, a, input, select, [popover], .ptz-click-layer";

export function useZoomPan(
  target: Ref<HTMLElement | null | undefined>,
  enabled: MaybeRefOrGetter<boolean> = true,
) {
  const scale = shallowRef(1);
  const x = shallowRef(0);
  const y = shallowRef(0);
  const panning = shallowRef(false);

  function size() {
    const el = target.value;
    return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 0, h: 0 };
  }

  /** keep the scaled picture covering the frame */
  function clamp() {
    const { w, h } = size();
    x.value = Math.min(0, Math.max(w * (1 - scale.value), x.value));
    y.value = Math.min(0, Math.max(h * (1 - scale.value), y.value));
  }

  function zoomAt(next: number, px: number, py: number) {
    const clamped = Math.min(MAX_SCALE, Math.max(1, next));
    const ratio = clamped / scale.value;
    x.value = px - (px - x.value) * ratio;
    y.value = py - (py - y.value) * ratio;
    scale.value = clamped;
    clamp();
  }

  function reset() {
    scale.value = 1;
    x.value = 0;
    y.value = 0;
  }

  function local(event: { clientX: number; clientY: number }) {
    const rect = target.value!.getBoundingClientRect();
    return { px: event.clientX - rect.left, py: event.clientY - rect.top };
  }

  function onWheel(event: WheelEvent) {
    if (!toValue(enabled)) return;
    event.preventDefault();
    const { px, py } = local(event);
    // trackpad pinches arrive as ctrl+wheel with small deltas
    const speed = event.ctrlKey ? 0.01 : 0.0015;
    zoomAt(scale.value * Math.exp(-event.deltaY * speed), px, py);
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let pinchStart: { distance: number; scale: number } | undefined;

  function pinchDistance() {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  function onPointerDown(event: PointerEvent) {
    if (!toValue(enabled) || event.button !== 0) return;
    if ((event.target as Element).closest(INTERACTIVE)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      pinchStart = { distance: pinchDistance(), scale: scale.value };
    }
    if (pointers.size === 2 || scale.value > 1) {
      target.value?.setPointerCapture(event.pointerId);
      panning.value = true;
    }
  }

  function onPointerMove(event: PointerEvent) {
    const last = pointers.get(event.pointerId);
    if (!last) return;
    const point = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, point);

    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()] as [typeof point, typeof point];
      const { px, py } = local({
        clientX: (a.x + b.x) / 2,
        clientY: (a.y + b.y) / 2,
      });
      zoomAt(
        (pinchStart.scale * pinchDistance()) / (pinchStart.distance || 1),
        px,
        py,
      );
      return;
    }
    if (scale.value > 1 && panning.value) {
      x.value += point.x - last.x;
      y.value += point.y - last.y;
      clamp();
    }
  }

  function onPointerUp(event: PointerEvent) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStart = undefined;
    if (!pointers.size) panning.value = false;
  }

  function onDoubleClick(event: MouseEvent) {
    if (!toValue(enabled)) return;
    if ((event.target as Element).closest(INTERACTIVE)) return;
    if (scale.value > 1) {
      reset();
      return;
    }
    const { px, py } = local(event);
    zoomAt(2, px, py);
  }

  const listeners: [string, EventListener, AddEventListenerOptions?][] = [
    ["wheel", onWheel as EventListener, { passive: false }],
    ["pointerdown", onPointerDown as EventListener],
    ["pointermove", onPointerMove as EventListener],
    ["pointerup", onPointerUp as EventListener],
    ["pointercancel", onPointerUp as EventListener],
    ["dblclick", onDoubleClick as EventListener],
  ];

  watch(
    target,
    (el, previous) => {
      for (const [type, fn] of listeners) {
        previous?.removeEventListener(type, fn);
        el?.addEventListener(type, fn, listeners.find((l) => l[1] === fn)?.[2]);
      }
    },
    { immediate: true },
  );
  onScopeDispose(() => {
    for (const [type, fn] of listeners)
      target.value?.removeEventListener(type, fn);
  });

  // the frame can resize (fullscreen, panels), keep the picture inside it
  const resize = new ResizeObserver(() => clamp());
  watch(
    target,
    (el, previous) => {
      if (previous) resize.unobserve(previous);
      if (el) resize.observe(el);
    },
    { immediate: true },
  );
  onScopeDispose(() => resize.disconnect());

  watch(
    () => toValue(enabled),
    (on) => !on && reset(),
  );

  return {
    scale,
    zoomed: computed(() => scale.value > 1.001),
    panning,
    reset,
    style: computed(() =>
      scale.value === 1
        ? undefined
        : {
            transform: `translate(${x.value}px, ${y.value}px) scale(${scale.value})`,
          },
    ),
  };
}
