/**
 * Demo mode for screenshots. Swaps every camera image for a stock photo and
 * gives cameras generic names, so no real footage or naming leaks.
 *
 * Turn it on with `?demo=1` (remembered in this browser) or `VITE_DEMO=1` at
 * build time. `?demo=0` turns it off again. Live streams are not opened.
 *
 * `?virtual=N` also adds N virtual cameras with a spread of resolutions
 * (portrait doorbells, 4:3, square, ultra wide) for testing layouts against
 * a small real setup. It implies demo mode, is remembered the same way and
 * `?virtual=0` removes them.
 */
import { baseUrl } from "@/api/baseUrl";

const STORAGE_KEY = "frigate-demo";
const VIRTUAL_KEY = "frigate-demo-virtual";
const VIRTUAL_MAX = 64;

/** one name per stock still in public/demo, in the same order */
const DEMO_NAMES = ["Entrance", "Loading Yard", "Car Park", "High Street"];

function readDemoFlag(): boolean {
  const param = new URLSearchParams(window.location.search).get("demo");
  try {
    if (param === "0" || param === "false") {
      localStorage.removeItem(STORAGE_KEY);
    } else if (param !== null) {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    if (localStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {
    // storage can be blocked; fall through to the url and build flags
  }
  if (param !== null) return param !== "0" && param !== "false";
  return import.meta.env.VITE_DEMO === "1";
}

function readVirtualCount(): number {
  const param = new URLSearchParams(window.location.search).get("virtual");
  const parsed = param === null ? NaN : Number.parseInt(param, 10);
  try {
    if (param !== null) {
      if (parsed > 0) localStorage.setItem(VIRTUAL_KEY, String(parsed));
      else localStorage.removeItem(VIRTUAL_KEY);
    }
    const stored = Number.parseInt(localStorage.getItem(VIRTUAL_KEY) ?? "", 10);
    if (stored > 0) return Math.min(stored, VIRTUAL_MAX);
  } catch {
    // storage can be blocked; fall back to the url alone
  }
  return parsed > 0 ? Math.min(parsed, VIRTUAL_MAX) : 0;
}

/** number of virtual cameras appended to the config */
export const virtualCameraCount = readVirtualCount();

export const demoMode = virtualCameraCount > 0 || readDemoFlag();

/** resolutions cycled through by the virtual cameras */
const VIRTUAL_SIZES: [number, number][] = [
  [720, 1280],
  [1280, 960],
  [1920, 1080],
  [960, 960],
  [640, 480],
  [2560, 1080],
  [1080, 1440],
  [1280, 720],
];

const VIRTUAL_PREFIX = "virtual_";

/** camera name to its position in ui order, filled from the config */
const demoIndex = new Map<string, number>();

type DemoCamera = {
  name: string;
  friendly_name?: string;
  ui?: { order?: number; dashboard?: boolean };
  detect?: { width?: number; height?: number };
};

/** Appends the virtual cameras, cloned from the first real camera. */
function addVirtualCameras(cameras: Record<string, DemoCamera>) {
  const real = Object.values(cameras);
  const template = real[0];
  if (!template || !virtualCameraCount) return;
  const lastOrder = Math.max(0, ...real.map((camera) => camera.ui?.order ?? 0));
  for (let i = 0; i < virtualCameraCount; i++) {
    const [width, height] = VIRTUAL_SIZES[i % VIRTUAL_SIZES.length];
    const name = `${VIRTUAL_PREFIX}${i + 1}`;
    const camera: DemoCamera = structuredClone(template);
    camera.name = name;
    camera.friendly_name = `Virtual ${width}×${height}`;
    camera.ui = { ...camera.ui, order: lastOrder + i + 1, dashboard: true };
    camera.detect = { ...camera.detect, width, height };
    cameras[name] = camera;
  }
}

/**
 * Rewrites friendly names in a fetched config and records each camera's
 * slot, so names and images stay paired across reloads.
 */
export function applyDemoConfig(config: unknown) {
  const cameras = (config as { cameras?: Record<string, DemoCamera> })?.cameras;
  if (!cameras) return;
  addVirtualCameras(cameras);
  Object.values(cameras)
    .sort(
      (a, b) =>
        (a.ui?.order ?? 0) - (b.ui?.order ?? 0) || a.name.localeCompare(b.name),
    )
    .forEach((camera, index) => {
      demoIndex.set(camera.name, index);
      // virtual cameras keep their resolution as the name
      if (camera.name.startsWith(VIRTUAL_PREFIX)) return;
      camera.friendly_name =
        index < DEMO_NAMES.length ? DEMO_NAMES[index] : `Camera ${index + 1}`;
    });
}

/**
 * Lets the virtual cameras through a profile that lists the user's allowed
 * cameras, which would otherwise filter them out.
 */
export function applyDemoProfile(profile: unknown) {
  const allowed = (profile as { allowed_cameras?: string[] | null })
    ?.allowed_cameras;
  if (!Array.isArray(allowed)) return;
  for (let i = 1; i <= virtualCameraCount; i++)
    allowed.push(`${VIRTUAL_PREFIX}${i}`);
}

/** Stock still standing in for a camera's frames. */
export function demoImage(camera: string): string {
  const index = demoIndex.get(camera) ?? 0;
  return `${baseUrl}demo/camera-${(index % DEMO_NAMES.length) + 1}.jpg`;
}
