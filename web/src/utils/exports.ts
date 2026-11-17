/** Helpers for finished exports. */
import { baseUrl, mediaUrl } from "@/api/baseUrl";
import type { Export } from "@/types/export";

const media = (path: string) =>
  mediaUrl(path.replace(/^\/media\/frigate\//, ""));

export function exportVideo(item: Export) {
  return media(item.video_path);
}

export function exportThumb(item: Export): string | undefined {
  return item.thumb_path ? media(item.thumb_path) : undefined;
}

/** Link that opens the exports page with this export playing. */
export function exportLink(item: Export) {
  return `${baseUrl}export?id=${encodeURIComponent(item.id)}`;
}
