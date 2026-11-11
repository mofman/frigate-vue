/** Picture in picture for the stage video. */

export function pipSupported() {
  return (
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    document.pictureInPictureEnabled
  );
}

export async function togglePip(video: HTMLVideoElement | undefined) {
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture().catch(() => undefined);
    return;
  }
  if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
  await video.requestPictureInPicture().catch(() => undefined);
}
