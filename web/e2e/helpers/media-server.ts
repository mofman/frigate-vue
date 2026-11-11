/**
 * Serves real media for playback tests: an fMP4 HLS VOD whose playlist is
 * sized to whatever window the app requests (cycling the fixture segments),
 * matching recording coverage, and a fake go2rtc MSE websocket streaming a
 * fragmented MP4 in real time.
 */
import type { Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MEDIA = join(dirname(fileURLToPath(import.meta.url)), "..", ".media");
const SEGMENT = 10;
const CODEC = 'video/mp4; codecs="avc1.64001e"';

export function mediaAvailable() {
  return (
    existsSync(join(MEDIA, "live.mp4")) &&
    existsSync(join(MEDIA, "vod", "index.m3u8"))
  );
}

/** Split an fMP4 into the init segment and moof+mdat fragments. */
function fragments(file: Buffer) {
  const boxes: { type: string; data: Buffer }[] = [];
  let offset = 0;
  while (offset + 8 <= file.length) {
    const size = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    boxes.push({ type, data: file.subarray(offset, offset + size) });
    offset += size;
  }
  const init = Buffer.concat(
    boxes
      .filter((b) => b.type === "ftyp" || b.type === "moov")
      .map((b) => b.data),
  );
  const frags: Buffer[] = [];
  for (let i = 0; i < boxes.length; i++) {
    if (boxes[i]!.type === "moof" && boxes[i + 1]?.type === "mdat") {
      frags.push(Buffer.concat([boxes[i]!.data, boxes[i + 1]!.data]));
    }
  }
  return { init, frags };
}

export class MediaServer {
  /** number of MSE websocket connections opened by the app */
  liveConnections = 0;
  vodPlaylists = 0;

  constructor(
    /** mimic Frigate versions without the recordings coverage endpoint */
    private options: { legacy?: boolean } = {},
  ) {}

  async install(page: Page) {
    const segments = readFileSync(join(MEDIA, "vod", "index.m3u8"), "utf-8")
      .split("\n")
      .filter((line) => line.endsWith(".m4s"));
    const live = fragments(readFileSync(join(MEDIA, "live.mp4")));

    const spansFor = (after: number, before: number) => {
      const spans = [];
      for (let t = after; t < before; t += SEGMENT) {
        spans.push({
          start_time: t,
          end_time: Math.min(t + SEGMENT, before),
          duration: SEGMENT * 1000,
        });
      }
      return spans;
    };

    // plain recording segments, durations in seconds
    await page.route(/\/api\/[a-z_]+\/recordings\?/, (route) => {
      const url = new URL(route.request().url());
      const after = Number(url.searchParams.get("after"));
      const before = Number(url.searchParams.get("before"));
      return route.fulfill({
        json: spansFor(after, before).map((span, i) => ({
          id: `rec-${i}`,
          ...span,
          duration: span.duration / 1000,
        })),
      });
    });

    // coverage: contiguous 10 second spans over the whole requested window
    await page.route(/\/api\/[a-z_]+\/recordings\/coverage/, (route) => {
      if (this.options.legacy) {
        return route.fulfill({ status: 404, json: { detail: "Not Found" } });
      }
      const url = new URL(route.request().url());
      const after = Number(url.searchParams.get("after"));
      const before = Number(url.searchParams.get("before"));
      const spans = [];
      for (let t = after; t < before; t += SEGMENT) {
        spans.push({
          start_time: t,
          end_time: Math.min(t + SEGMENT, before),
          duration: SEGMENT * 1000,
        });
      }
      return route.fulfill({
        json: {
          spans: [{ start_time: after, end_time: before, streams: ["main"] }],
          timelines: { auto: spans, main: spans, sub: [] },
        },
      });
    });

    // vod playlist sized to the window, cycling through the fixture
    await page.route(
      /\/vod\/[a-z_]+\/start\/[\d.]+\/end\/[\d.]+\/master\.m3u8/,
      (route) => {
        this.vodPlaylists++;
        const match = route
          .request()
          .url()
          .match(/start\/([\d.]+)\/end\/([\d.]+)/)!;
        const count = Math.ceil(
          (Number(match[2]) - Number(match[1])) / SEGMENT,
        );
        const lines = [
          "#EXTM3U",
          "#EXT-X-VERSION:7",
          `#EXT-X-TARGETDURATION:${SEGMENT}`,
          "#EXT-X-PLAYLIST-TYPE:VOD",
          '#EXT-X-MAP:URI="/vodmedia/init.mp4"',
        ];
        for (let i = 0; i < count; i++) {
          if (i > 0 && i % segments.length === 0) {
            lines.push(
              "#EXT-X-DISCONTINUITY",
              '#EXT-X-MAP:URI="/vodmedia/init.mp4"',
            );
          }
          lines.push(
            `#EXTINF:${SEGMENT}.000,`,
            `/vodmedia/${segments[i % segments.length]}`,
          );
        }
        lines.push("#EXT-X-ENDLIST");
        return route.fulfill({
          contentType: "application/vnd.apple.mpegurl",
          body: lines.join("\n"),
        });
      },
    );

    await page.route("**/vodmedia/*", (route) => {
      const name = new URL(route.request().url()).pathname.split("/").pop()!;
      return route.fulfill({
        contentType: "video/mp4",
        body: readFileSync(join(MEDIA, "vod", name)),
      });
    });

    // fake go2rtc: negotiate, send init, then one fragment per second
    await page.routeWebSocket(/\/live\/mse\/api\/ws/, (ws) => {
      this.liveConnections++;
      let timer: ReturnType<typeof setInterval> | undefined;
      ws.onMessage((message) => {
        const data = JSON.parse(message.toString());
        if (data.type !== "mse") return;
        ws.send(JSON.stringify({ type: "mse", value: CODEC }));
        ws.send(live.init);
        let index = 0;
        // prime a couple of fragments so playback starts promptly
        ws.send(live.frags[index++]!);
        timer = setInterval(() => {
          if (index >= live.frags.length) return clearInterval(timer);
          ws.send(live.frags[index++]!);
        }, 1000);
      });
      ws.onClose(() => clearInterval(timer));
    });
  }
}
