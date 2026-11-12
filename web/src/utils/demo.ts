/**
 * Demo mode for screenshots. Swaps every camera image for a stock photo and
 * gives cameras generic names, so no real footage or naming leaks.
 *
 * Turn it on with `?demo=1` (remembered in this browser) or `VITE_DEMO=1` at
 * build time. `?demo=0` turns it off again. Live streams are not opened.
 */
import { baseUrl } from "@/api/baseUrl";

const STORAGE_KEY = "frigate-demo";

const DEMO_NAMES = [
  "Driveway",
  "Front Yard",
  "Porch",
  "Pool",
  "Back Garden",
  "Back Yard",
  "Patio",
  "Side Yard",
  "Terrace",
  "Hallway",
];

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

export const demoMode = readDemoFlag();

/** camera name to its position in ui order, filled from the config */
const demoIndex = new Map<string, number>();

type DemoCamera = {
  name: string;
  friendly_name?: string;
  ui?: { order?: number };
};

/**
 * Rewrites friendly names in a fetched config and records each camera's
 * slot, so names and images stay paired across reloads.
 */
export function applyDemoConfig(config: unknown) {
  const cameras = (config as { cameras?: Record<string, DemoCamera> })?.cameras;
  if (!cameras) return;
  Object.values(cameras)
    .sort(
      (a, b) =>
        (a.ui?.order ?? 0) - (b.ui?.order ?? 0) || a.name.localeCompare(b.name),
    )
    .forEach((camera, index) => {
      demoIndex.set(camera.name, index);
      camera.friendly_name =
        index < DEMO_NAMES.length ? DEMO_NAMES[index] : `Camera ${index + 1}`;
    });
}

/** Stock still standing in for a camera's frames. */
export function demoImage(camera: string): string {
  const index = demoIndex.get(camera) ?? 0;
  return `${baseUrl}demo/camera-${(index % DEMO_NAMES.length) + 1}.webp`;
}
