/**
 * Frigate's jsmpeg low-bandwidth stream, decoded onto a canvas.
 *
 * The canvas is sized by CSS (object-fit: contain), so no resize observer is
 * needed and it always matches the stage box.
 */
// @ts-expect-error the package ships without types
import JSMpeg from "@cycjimmy/jsmpeg-player";
import { wsBaseUrl } from "@/api/baseUrl";
import { LiveSession } from "./session";

type JSMpegVideoElement = { destroy: () => void };

export class JsmpegSession extends LiveSession {
  readonly element: HTMLDivElement = document.createElement("div");
  private canvas: HTMLCanvasElement = document.createElement("canvas");
  private player: JSMpegVideoElement | null = null;
  private decoded = false;

  constructor(
    private camera: string,
    private useWebGL = true,
  ) {
    super("jsmpeg", camera);
    this.element.className = "live-media live-media--jsmpeg";
    this.canvas.className = "live-media";
    this.element.appendChild(this.canvas);
  }

  connect() {
    if (this.player) return;
    this.status.value = "connecting";
    this.decoded = false;

    this.player = new JSMpeg.VideoElement(
      this.element,
      `${wsBaseUrl}live/jsmpeg/${encodeURIComponent(this.camera)}`,
      { canvas: this.canvas },
      {
        protocols: [],
        audio: false,
        disableGl: !this.useWebGL,
        disableWebAssembly: !this.useWebGL,
        videoBufferSize: 1024 * 1024 * 4,
        onVideoDecode: () => {
          if (this.decoded) return;
          this.decoded = true;
          this.resolution.value = {
            width: this.canvas.width,
            height: this.canvas.height,
          };
          this.firstFrameAt.value = performance.now();
          this.markPlaying();
        },
      },
    ) as JSMpegVideoElement;
  }

  disconnect() {
    try {
      this.player?.destroy();
    } catch {
      // jsmpeg throws if the socket never opened
    }
    this.player = null;
    // destroy() removes our canvas from the wrapper
    if (!this.canvas.isConnected) this.element.appendChild(this.canvas);
    if (this.status.value !== "error") this.status.value = "idle";
  }

  resume() {
    // jsmpeg keeps decoding while parked, the next frame is already there
    this.firstFrameAt.value = performance.now();
  }
}
