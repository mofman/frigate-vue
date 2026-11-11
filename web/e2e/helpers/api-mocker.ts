/**
 * REST API mock using Playwright's page.route().
 *
 * Intercepts all /api/* requests and returns factory-generated responses.
 * Must be installed BEFORE page.goto() to prevent auth redirects.
 */

import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASE_CONFIG,
  type DeepPartial,
  configFactory,
} from "../fixtures/mock-data/config";
import { DETECTION_HARDWARE } from "../fixtures/mock-data/hardware";
import { adminProfile, type UserProfile } from "../fixtures/mock-data/profile";
import { BASE_STATS, statsFactory } from "../fixtures/mock-data/stats";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_DATA_DIR = resolve(__dirname, "../fixtures/mock-data");

function loadMockJson(filename: string): unknown {
  return JSON.parse(readFileSync(resolve(MOCK_DATA_DIR, filename), "utf-8"));
}

// 1x1 transparent PNG
export const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const MOCK_LOG_LINES = [
  "2026-04-06 10:00:00.000000000  [2026-04-06 10:00:00] frigate.app                    INFO    : Starting Frigate",
  "2026-04-06 10:00:01.000000000  [2026-04-06 10:00:01] frigate.video                  WARNING : front_door: stream is slow",
  "2026-04-06 10:00:02.000000000  [2026-04-06 10:00:02] frigate.record                 ERROR   : Unable to write segment",
];

export interface ApiMockOverrides {
  config?: DeepPartial<typeof BASE_CONFIG>;
  profile?: UserProfile;
  stats?: DeepPartial<typeof BASE_STATS>;
  reviews?: unknown[];
  events?: unknown[];
  exports?: unknown[];
  cases?: unknown[];
  faces?: Record<string, unknown>;
  configRaw?: string;
  /** lines returned by /logs/{service} */
  logLines?: string[];
  /** body of the /logs/{service}?stream=true response */
  logStream?: string;
  cameraStorage?: Record<string, unknown>;
  configSchema?: Record<string, unknown>;
  hardware?: unknown[];
  hwaccel?: {
    recommended: string;
    available?: { key: string; presets: Record<string, string> }[];
  };
  users?: { username: string; role: string }[];
  notices?: unknown[];
  mutedChecks?: unknown[];
  /** camera name to the ffprobe entries returned for `paths=camera:<name>` */
  ffprobe?: Record<string, unknown[]>;
}

export const FFPROBE_OK = [
  {
    return_code: 0,
    stderr: "",
    stdout: {
      streams: [
        {
          codec_type: "video",
          codec_name: "h264",
          width: 1920,
          height: 1080,
          avg_frame_rate: "15/1",
        },
        { codec_type: "audio", codec_name: "aac" },
      ],
    },
  },
];

export class ApiMocker {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async install(overrides?: ApiMockOverrides) {
    const config = configFactory(overrides?.config);
    const profile = overrides?.profile ?? adminProfile();
    const stats = statsFactory(overrides?.stats);
    const reviews =
      overrides?.reviews ?? (loadMockJson("reviews.json") as unknown[]);
    const events =
      overrides?.events ?? (loadMockJson("events.json") as unknown[]);
    const exports =
      overrides?.exports ?? (loadMockJson("exports.json") as unknown[]);
    const cases = overrides?.cases ?? (loadMockJson("cases.json") as unknown[]);
    const reviewSummary = loadMockJson("review-summary.json");

    // Config endpoint
    await this.page.route("**/api/config", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({ json: config });
      }
      return route.fulfill({ json: { success: true } });
    });

    // Profile endpoint (AuthProvider fetches /profile directly via axios,
    // which resolves to /api/profile due to axios.defaults.baseURL)
    await this.page.route("**/profile", (route) =>
      route.fulfill({ json: profile }),
    );

    // Stats endpoint
    await this.page.route("**/api/stats", (route) =>
      route.fulfill({ json: stats }),
    );

    // Reviews. The real backend exposes /review (singular) for the main
    // list and /review/summary for the summary — the previous plural glob
    // (**/api/reviews**) never matched either endpoint, so review-dependent
    // tests silently ran without data. The POST mutations at /reviews/viewed
    // and /reviews/delete (plural) still fall through to the generic
    // mutation catch-all further down the file.
    await this.page.route(/\/api\/review\/summary/, (route) =>
      route.fulfill({ json: reviewSummary }),
    );
    // the generator serializes review times as ISO strings, the real api
    // returns unix seconds
    const toEpoch = (value: unknown) =>
      typeof value === "string" ? Date.parse(value) / 1000 : value;
    const reviewRows = (reviews as Record<string, unknown>[]).map((row) => ({
      ...row,
      start_time: toEpoch(row.start_time),
      end_time: toEpoch(row.end_time),
    }));
    await this.page.route(/\/api\/review(\?|$)/, (route) =>
      route.fulfill({ json: reviewRows }),
    );

    // Export jobs. The Exports page polls this every 2s while any export
    // is in_progress; without a mock route it falls through to the preview
    // server which returns 500 and makes the page flap between loading and
    // rendered state, breaking tests that navigate to /export.
    await this.page.route("**/api/jobs/export", (route) =>
      route.fulfill({ json: [] }),
    );

    // Recordings summary
    await this.page.route("**/api/recordings/summary**", (route) =>
      route.fulfill({ json: {} }),
    );

    // Previews (needed for review page event cards)
    await this.page.route("**/api/preview/**", (route) =>
      route.fulfill({ json: [] }),
    );

    // Sub-labels and attributes (for explore filters).
    // Use trailing ** so query-string variants (e.g. ?split_joined=1) match.
    await this.page.route("**/api/sub_labels**", (route) =>
      route.fulfill({ json: [] }),
    );
    await this.page.route("**/api/labels**", (route) =>
      route.fulfill({ json: ["person", "car"] }),
    );
    await this.page.route("**/api/*/attributes", (route) =>
      route.fulfill({ json: [] }),
    );
    await this.page.route("**/api/recognized_license_plates", (route) =>
      route.fulfill({ json: [] }),
    );

    // Events / search
    await this.page.route("**/api/events**", (route) =>
      route.fulfill({ json: events }),
    );

    // Exports
    await this.page.route("**/api/export**", (route) =>
      route.fulfill({ json: exports }),
    );

    // Cases
    await this.page.route("**/api/cases", (route) =>
      route.fulfill({ json: cases }),
    );

    // Faces
    await this.page.route("**/api/faces", (route) =>
      route.fulfill({ json: overrides?.faces ?? {} }),
    );

    // Logs: a JSON page of lines, a text stream, or the whole file to
    // download, depending on the query
    await this.page.route("**/api/logs/**", (route) => {
      const url = new URL(route.request().url());
      const lines = overrides?.logLines ?? MOCK_LOG_LINES;
      if (url.searchParams.get("stream") === "true") {
        return route.fulfill({
          contentType: "text/plain",
          body: overrides?.logStream ?? "",
        });
      }
      if (url.searchParams.has("download")) {
        return route.fulfill({ json: lines.join("\n") });
      }
      return route.fulfill({
        json: { totalLines: lines.length, lines },
      });
    });

    // Stats history for the System charts: a short window ending now
    await this.page.route("**/api/stats/history**", (route) => {
      const now = Date.now() / 1000;
      return route.fulfill({
        json: Array.from({ length: 6 }, (_, index) => ({
          ...stats,
          service: { ...stats.service, last_updated: now - (5 - index) * 15 },
        })),
      });
    });

    // Recordings storage per camera, MiB
    await this.page.route("**/api/recordings/storage", (route) =>
      route.fulfill({
        json: overrides?.cameraStorage ?? {
          front_door: { usage: 20480, bandwidth: 512, usage_percent: 40 },
          backyard: { usage: 10240, bandwidth: 256, usage_percent: 20 },
        },
      }),
    );

    // Config raw
    await this.page.route("**/api/config/raw", (route) =>
      route.fulfill({
        // like the backend: a JSON encoded string labelled text/plain
        contentType: "text/plain",
        body: JSON.stringify(
          overrides?.configRaw ??
            "mqtt:\n  host: mqtt\ncameras:\n  front_door:\n    enabled: true\n",
        ),
      }),
    );

    // Config schema
    await this.page.route("**/api/config/schema.json", (route) =>
      route.fulfill({
        json: overrides?.configSchema ?? { type: "object", properties: {} },
      }),
    );

    // Config set (mutation)
    await this.page.route("**/api/config/set", (route) =>
      route.fulfill({ json: { success: true, require_restart: false } }),
    );

    // Detection hardware discovery
    await this.page.route("**/api/hardware/probe**", (route) =>
      route.fulfill({ json: overrides?.hardware ?? DETECTION_HARDWARE }),
    );

    // Hwaccel preset recommendation
    await this.page.route("**/api/hardware/hwaccel**", (route) =>
      route.fulfill({
        json: {
          recommended: "",
          available: [],
          ...(overrides?.hwaccel ?? {}),
        },
      }),
    );

    // ffprobe. The Health tab's stream checks probe `camera:<name>`; the
    // wizard probes raw URLs. Both get a healthy h264 + aac answer by default.
    await this.page.route("**/api/ffprobe**", (route) => {
      const url = new URL(route.request().url());
      const paths = url.searchParams.get("paths") ?? "";
      const camera = paths.startsWith("camera:") ? paths.slice(7) : undefined;
      const entries = (camera && overrides?.ffprobe?.[camera]) || FFPROBE_OK;
      return route.fulfill({ json: entries });
    });

    // Notices
    await this.page.route("**/api/notices", (route) =>
      route.fulfill({ json: overrides?.notices ?? [] }),
    );
    await this.page.route("**/api/notices/muted_checks", (route) =>
      route.fulfill({ json: overrides?.mutedChecks ?? [] }),
    );

    // Users. GET lists them; POST/PUT (create, password) just succeed, so
    // tests assert on the intercepted request body instead of a response.
    await this.page.route("**/api/users**", (route) =>
      route.request().method() === "GET"
        ? route.fulfill({
            json: overrides?.users ?? [{ username: "admin", role: "admin" }],
          })
        : route.fulfill({ json: { message: "ok" } }),
    );

    // Go2RTC streams
    await this.page.route("**/api/go2rtc/streams**", (route) =>
      route.fulfill({ json: {} }),
    );

    // Profiles
    await this.page.route("**/api/profiles**", (route) =>
      route.fulfill({
        json: { profiles: [], active_profile: null, last_activated: {} },
      }),
    );

    // Motion search
    await this.page.route("**/api/motion_search**", (route) =>
      route.fulfill({ json: { job_id: "test-job" } }),
    );

    // Region grid
    await this.page.route("**/api/*/region_grid", (route) =>
      route.fulfill({ json: {} }),
    );

    // Debug replay
    await this.page.route("**/api/debug_replay/**", (route) =>
      route.fulfill({ json: {} }),
    );

    // Generic mutation catch-all for remaining endpoints.
    // Uses route.fallback() to defer to more specific routes registered above.
    // Playwright matches routes in reverse registration order (last wins),
    // so this catch-all must use fallback() to let specific routes take precedence.
    await this.page.route("**/api/**", (route) => {
      const method = route.request().method();
      if (
        method === "POST" ||
        method === "PUT" ||
        method === "PATCH" ||
        method === "DELETE"
      ) {
        return route.fulfill({ json: { success: true } });
      }
      // Fall through to more specific routes for GET requests
      return route.fallback();
    });
  }
}

export class MediaMocker {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async install() {
    // Camera snapshots
    await this.page.route("**/api/*/latest.jpg**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: PLACEHOLDER_PNG,
      }),
    );

    // Clips and thumbnails
    await this.page.route("**/clips/**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: PLACEHOLDER_PNG,
      }),
    );

    // Event thumbnails. The explore grid and detail dialog request .webp,
    // everything else requests .jpg.
    await this.page.route("**/api/events/*/thumbnail.{jpg,webp}**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: PLACEHOLDER_PNG,
      }),
    );

    // Event snapshots
    await this.page.route("**/api/events/*/snapshot.jpg**", (route) =>
      route.fulfill({
        contentType: "image/png",
        body: PLACEHOLDER_PNG,
      }),
    );

    // VOD / recordings
    await this.page.route("**/vod/**", (route) =>
      route.fulfill({
        contentType: "application/vnd.apple.mpegurl",
        body: "#EXTM3U\n#EXT-X-ENDLIST\n",
      }),
    );

    // Live streams
    await this.page.route("**/live/**", (route) =>
      route.fulfill({
        contentType: "application/vnd.apple.mpegurl",
        body: "#EXTM3U\n#EXT-X-ENDLIST\n",
      }),
    );
  }
}
