/**
 * Single shared connection to Frigate's /ws event socket.
 *
 * Topics are stored in a reactive map so any component can read the latest
 * payload with useWsTopic(). camera_activity snapshots are expanded into
 * per-camera topics the same way the backend publishes them individually.
 */
import {
  onScopeDispose,
  readonly,
  shallowReactive,
  toValue,
  type MaybeRefOrGetter,
  computed,
} from "vue";
import { wsBaseUrl } from "./baseUrl";
import type { FrigateCameraState } from "@/types/frigate";

type Message = { topic: string; payload: unknown; retain?: boolean };
type Listener = (payload: unknown) => void;

const state = shallowReactive(new Map<string, unknown>());
const listeners = new Map<string, Set<Listener>>();
const pending = new Map<string, Message>();

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let attempt = 0;
let started = false;
let lastActivityPayload: string | null = null;

const connected = shallowReactive({ value: false });

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function apply(topic: string, payload: unknown, force = false) {
  if (!force && sameValue(state.get(topic), payload)) return;
  state.set(topic, payload);
  listeners.get(topic)?.forEach((listener) => listener(payload));
}

function onOff(value: boolean | undefined) {
  return value ? "ON" : "OFF";
}

function applyCameraActivity(raw: string) {
  if (raw === lastActivityPayload) return;
  lastActivityPayload = raw;

  let activity: Record<string, FrigateCameraState>;
  try {
    activity = JSON.parse(raw);
  } catch {
    return;
  }

  for (const [name, camera] of Object.entries(activity)) {
    apply(`camera_activity/${name}`, camera, true);
    const config = camera?.config;
    if (!config) continue;
    apply(`${name}/recordings/state`, onOff(config.record));
    apply(`${name}/enabled/state`, onOff(config.enabled));
    apply(`${name}/detect/state`, onOff(config.detect));
    apply(`${name}/snapshots/state`, onOff(config.snapshots));
    apply(`${name}/audio/state`, onOff(config.audio));
    apply(`${name}/ptz_autotracker/state`, onOff(config.autotracking));
    if (config.audio_transcription !== undefined)
      apply(
        `${name}/audio_transcription/state`,
        onOff(config.audio_transcription),
      );
    if (config.notifications !== undefined)
      apply(`${name}/notifications/state`, onOff(config.notifications));
    apply(
      `${name}/notifications/suspended`,
      config.notifications_suspended ?? 0,
    );
  }
}

function handleMessage(event: MessageEvent<string>) {
  let message: Message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }
  if (!message) return;

  if (message.topic === "camera_activity") {
    applyCameraActivity(message.payload as string);
    return;
  }

  let payload = message.payload;
  // reviews, events and stats arrive as JSON encoded strings
  if (typeof payload === "string" && /^[[{]/.test(payload)) {
    try {
      payload = JSON.parse(payload);
    } catch {
      // keep the raw string
    }
  }
  apply(message.topic, payload);
}

function connect() {
  socket = new WebSocket(`${wsBaseUrl}ws`);

  socket.onopen = () => {
    attempt = 0;
    connected.value = true;
    // events may have been missed while disconnected, so the next snapshot
    // must apply even if it is byte identical
    lastActivityPayload = null;
    socket?.send(
      JSON.stringify({ topic: "onConnect", message: "", retain: false }),
    );
    for (const message of pending.values()) {
      socket?.send(JSON.stringify(message));
    }
    pending.clear();
  };

  socket.onmessage = handleMessage;

  socket.onclose = () => {
    connected.value = false;
    const delay = Math.min(1000 * 2 ** attempt, 30000);
    attempt++;
    reconnectTimer = setTimeout(connect, delay);
  };

  socket.onerror = () => socket?.close();
}

/** Open the shared socket. Called once after auth resolves. */
export function startWs() {
  if (started) return;
  started = true;
  connect();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") requestActivitySnapshot();
  });
}

export function stopWs() {
  started = false;
  clearTimeout(reconnectTimer);
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

export function sendWs(topic: string, payload: unknown, retain = false) {
  const message = { topic, payload, retain };
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    pending.set(topic, message);
  }
}

let snapshotQueued = false;
/** Ask the backend to republish camera_activity, coalesced per tick. */
export function requestActivitySnapshot() {
  if (snapshotQueued) return;
  snapshotQueued = true;
  queueMicrotask(() => {
    snapshotQueued = false;
    lastActivityPayload = null;
    sendWs("onConnect", "");
  });
}

/** Reactive latest payload for a topic. */
export function useWsTopic<T>(topic: MaybeRefOrGetter<string>) {
  return computed(() => state.get(toValue(topic)) as T | undefined);
}

/** Run a callback for every message on a topic, including repeats. */
export function onWsMessage<T>(topic: string, listener: (payload: T) => void) {
  let set = listeners.get(topic);
  if (!set) {
    set = new Set();
    listeners.set(topic, set);
  }
  const wrapped = listener as Listener;
  set.add(wrapped);
  const off = () => set?.delete(wrapped);
  onScopeDispose(off);
  return off;
}

export const wsConnected = readonly(connected);
