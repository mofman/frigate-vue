/**
 * Real media playback: live (fake go2rtc MSE) and recordings (fMP4 HLS)
 * through the camera stage, checking that switches never show an empty
 * frame, never shift layout, and reuse the warm live connection.
 */
import { test, expect } from "../fixtures/frigate-test";
import { MediaServer, mediaAvailable } from "../helpers/media-server";
import { generateMedia } from "../scripts/generate-media.mjs";

test.beforeAll(() => {
  generateMedia();
});

/**
 * Samples every animation frame. A violation is a frame where the frozen
 * frame hold is not covering the stage and the visible layer has nothing
 * decoded to show.
 */
function installSampler() {
  type Sample = { t: number; layer: string; hold: number; ready: boolean };
  const w = window as unknown as {
    __samples: Sample[];
    __violations: Sample[];
  };
  w.__samples = [];
  w.__violations = [];
  // remember media that already has a frame on screen
  document
    .querySelectorAll<HTMLVideoElement>(".stage video")
    .forEach((video) => {
      if (video.readyState >= 2) video.dataset.painted = "1";
    });
  const tick = () => {
    const stage = document.querySelector(".stage") as HTMLElement | null;
    if (stage) {
      const hold = stage.querySelector(".frame-hold") as HTMLElement;
      const holdOpacity = Number(getComputedStyle(hold).opacity);
      const active = stage.querySelector(".stage__layer.is-active");
      const media = active?.querySelector("video, img, canvas") as
        HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null;
      let ready = false;
      // a seeking element keeps presenting its previous frame
      if (media instanceof HTMLVideoElement) {
        ready =
          media.videoWidth > 0 &&
          (media.readyState >= 2 ||
            (media.seeking && media.dataset.painted === "1"));
        if (media.readyState >= 2) media.dataset.painted = "1";
      } else if (media instanceof HTMLImageElement)
        ready = media.complete && media.naturalWidth > 0;
      else if (media) ready = media.width > 0;
      const sample = {
        t: performance.now(),
        layer: stage.dataset.layer ?? "",
        hold: holdOpacity,
        ready,
      };
      w.__samples.push(sample);
      if (!ready && holdOpacity < 0.99) w.__violations.push(sample);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

test.describe("seamless playback", () => {
  test.skip(() => !mediaAvailable(), "ffmpeg fixtures unavailable");

  test("live to recording to live without black frames or reconnects", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const media = new MediaServer();
    await frigateApp.api.install({
      config: {
        go2rtc: {
          streams: {
            front_door: "rtsp://camera/front",
            backyard: "rtsp://camera/back",
          },
        },
      },
    });
    await media.install(page);

    await frigateApp.goto("/camera/front_door");
    await expect(
      page.locator(".live-video[data-status='playing']"),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".stage[data-layer='live']")).toBeVisible();
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();
    const stageBefore = await page.locator(".stage").boundingBox();

    await page.evaluate(installSampler);

    // drag the playhead back ~12 minutes and release into recordings
    const pill = (await page.locator(".handle__pill").boundingBox())!;
    await page.mouse.move(pill.x + pill.width / 2, pill.y + pill.height / 2);
    await page.mouse.down();
    await page.mouse.move(pill.x + pill.width / 2, pill.y + 200, { steps: 10 });
    await page.mouse.up();

    await expect(page.locator(".stage[data-layer='recording']")).toBeVisible({
      timeout: 10_000,
    });
    // recorded media is actually advancing
    const video = page.locator(".stage__video");
    const t1 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    await page.waitForTimeout(1200);
    const t2 = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(t2).toBeGreaterThan(t1);

    // back to live: the parked session resumes instead of reconnecting
    await page
      .locator(".page-header")
      .getByRole("button", { name: "Live" })
      .click();
    await expect(page.locator(".stage[data-layer='live']")).toBeVisible({
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    const { violations, samples, layers } = await page.evaluate(() => {
      const w = window as unknown as {
        __violations: unknown[];
        __samples: { layer: string; hold: number }[];
      };
      const sequence: string[] = [];
      for (const sample of w.__samples) {
        const label = `${sample.layer}${sample.hold > 0.01 ? "+hold" : ""}`;
        if (sequence.at(-1) !== label) sequence.push(label);
      }
      return {
        violations: w.__violations,
        samples: w.__samples.length,
        layers: sequence,
      };
    });
    // the sampler must have watched the whole round trip
    expect(samples).toBeGreaterThan(60);
    // without preview clips the frozen live frame covers the drag
    expect(layers).toContain("live+hold");
    expect(layers).toContain("recording");
    expect(layers.at(-1)).toBe("live");
    expect(violations, "frames with nothing on screen").toEqual([]);
    test
      .info()
      .annotations.push({ type: "layers", description: layers.join(" > ") });
    expect(media.liveConnections, "live stream reconnected").toBe(1);

    const stageAfter = await page.locator(".stage").boundingBox();
    expect(stageAfter).toEqual(stageBefore);
  });

  test("seeking inside the loaded recording does not rebuild the playlist", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const media = new MediaServer();
    await frigateApp.api.install({
      config: { go2rtc: { streams: { front_door: "rtsp://camera/front" } } },
    });
    await media.install(page);

    const target = Math.floor(Date.now() / 1000) - 2 * 3600;
    await frigateApp.goto(`/camera/front_door?t=${target}`);
    await expect(page.locator(".stage[data-layer='recording']")).toBeVisible({
      timeout: 10_000,
    });
    await expect
      .poll(
        () =>
          page
            .locator(".stage__video")
            .evaluate((v: HTMLVideoElement) => v.readyState),
        { timeout: 10_000 },
      )
      .toBeGreaterThanOrEqual(2);
    await expect(page.locator(".frame-hold.is-visible")).toHaveCount(0);
    // let the hold finish fading out
    await page.waitForTimeout(300);
    const playlists = media.vodPlaylists;
    expect(playlists).toBe(1);

    await page.evaluate(installSampler);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(800);

    expect(media.vodPlaylists).toBe(playlists);
    const violations = await page.evaluate(
      () => (window as unknown as { __violations: unknown[] }).__violations,
    );
    expect(violations).toEqual([]);
  });

  test("opening a tile hands its stream to the stage without reconnecting", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const media = new MediaServer();
    await frigateApp.api.install({
      config: { go2rtc: { streams: { front_door: "rtsp://camera/front" } } },
    });
    await media.install(page);
    await page.addInitScript(() =>
      localStorage.setItem(
        "frigate:dashboard-streaming",
        JSON.stringify("continuous"),
      ),
    );

    await frigateApp.goto("/");
    const tile = page.getByRole("button", { name: /open front door/i });
    await expect(
      tile.locator(".live-video[data-status='playing']"),
    ).toBeVisible({ timeout: 15_000 });

    await tile.click();
    await expect(page).toHaveURL(/\/camera\/front_door$/);
    await expect(page.locator(".stage[data-layer='live']")).toBeVisible();
    await expect(
      page.locator(".stage .live-video[data-status='playing']"),
    ).toBeVisible();
    await expect(page.locator(".frame-hold.is-visible")).toHaveCount(0, {
      timeout: 3_000,
    });
    expect(media.liveConnections).toBe(1);
  });

  test("plays recordings on servers without the coverage endpoint", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const media = new MediaServer({ legacy: true });
    await frigateApp.api.install({
      config: { go2rtc: { streams: { front_door: "rtsp://camera/front" } } },
    });
    await media.install(page);

    await frigateApp.goto("/camera/front_door");
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();
    const pill = (await page.locator(".handle__pill").boundingBox())!;
    await page.mouse.move(pill.x + pill.width / 2, pill.y + pill.height / 2);
    await page.mouse.down();
    await page.mouse.move(pill.x + pill.width / 2, pill.y + 200, { steps: 10 });
    await page.mouse.up();

    await expect(page.locator(".stage[data-layer='recording']")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(".stage__message")).toHaveCount(0);
    const video = page.locator(".stage__video");
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0.5);
  });
});
