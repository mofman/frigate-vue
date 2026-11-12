/** Review item helpers shared by the activity panel and review list. */
import { mediaUrl, baseUrl } from "@/api/baseUrl";
import { http } from "@/api/http";
import type { ReviewSegment } from "@/types/frigate";
import { demoImage, demoMode } from "@/utils/demo";

/** seconds of lead-in before a review item when opening its recording */
export const REVIEW_PADDING = 4;

export function reviewThumb(review: ReviewSegment) {
  if (demoMode) return demoImage(review.camera);
  return mediaUrl(review.thumb_path.replace(/^\/media\/frigate\//, ""));
}

/** Hover preview clip, none in demo mode where only stills are shown. */
export function reviewPreview(review: ReviewSegment): string | undefined {
  if (demoMode) return undefined;
  return `${baseUrl}api/review/${review.id}/preview?format=mp4`;
}

/** Most relevant label to headline a review item with. */
export function reviewLabel(review: ReviewSegment) {
  return (
    review.data.sub_labels?.[0] ??
    review.data.objects[0] ??
    review.data.audio[0] ??
    (review.severity === "significant_motion" ? "motion" : "motion")
  );
}

export function markReviewed(ids: string[], reviewed = true) {
  if (!ids.length) return Promise.resolve();
  return http.post("reviews/viewed", { ids, reviewed });
}

export function reviewStart(review: ReviewSegment) {
  return Math.max(0, review.start_time - REVIEW_PADDING);
}
