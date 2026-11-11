/** Save a still from a camera as a downloaded jpeg. */
import { baseUrl } from "@/api/baseUrl";

type Frame = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement;

function frameSize(source: Frame): [number, number] {
  if (source instanceof HTMLVideoElement)
    return [source.videoWidth, source.videoHeight];
  if (source instanceof HTMLImageElement)
    return [source.naturalWidth, source.naturalHeight];
  return [source.width, source.height];
}

/** Draw the frame currently on screen, or undefined if nothing has decoded. */
function grabFrame(source: Frame): Promise<Blob | null> {
  const [width, height] = frameSize(source);
  if (!width || !height) return Promise.resolve(null);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  try {
    context.drawImage(source, 0, 0, width, height);
  } catch {
    // a tainted or detached source cannot be read back
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    } catch {
      resolve(null);
    }
  });
}

async function fetchLatest(camera: string): Promise<Blob | null> {
  const response = await fetch(
    `${baseUrl}api/${encodeURIComponent(camera)}/latest.jpg`,
    { cache: "no-store", credentials: "include" },
  );
  if (!response.ok) return null;
  const blob = await response.blob();
  return blob.size ? blob : null;
}

function stamp(time: number) {
  return new Date(time * 1000).toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download what is on screen when possible, otherwise the server's latest
 * frame. Returns false when neither produced an image.
 */
export async function saveSnapshot(
  camera: string,
  options: { source?: Frame; time?: number } = {},
): Promise<boolean> {
  let blob = options.source ? await grabFrame(options.source) : null;
  blob ??= await fetchLatest(camera).catch(() => null);
  if (!blob) return false;
  download(blob, `${camera}_${stamp(options.time ?? Date.now() / 1000)}.jpg`);
  return true;
}
