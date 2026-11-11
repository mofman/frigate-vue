import { test, expect } from "../fixtures/frigate-test";
import { viewerProfile } from "../fixtures/mock-data/profile";

test.describe("camera stage controls", () => {
  test("admins get camera switches that send ws commands", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await page.getByRole("button", { name: "Stream settings" }).click();
    const detect = page.getByRole("switch", { name: "Object detection" });
    await expect(detect).toBeAttached();
    await page.locator("label", { has: detect }).click();
    await expect
      .poll(() =>
        frigateApp.ws.sent.some((m) => m.topic === "front_door/detect/set"),
      )
      .toBe(true);
  });

  test("viewers do not see camera switches", async ({ frigateApp }) => {
    await frigateApp.api.install({ profile: viewerProfile() });
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await page.getByRole("button", { name: "Stream settings" }).click();
    await expect(
      page.getByRole("switch", { name: "Show stream stats" }),
    ).toBeAttached();
    await expect(
      page.getByRole("switch", { name: "Object detection" }),
    ).toHaveCount(0);
  });

  test("record now creates an on demand event and ends it", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const calls: string[] = [];
    await page.route("**/api/events/front_door/on_demand/create", (route) => {
      calls.push("create");
      return route.fulfill({ json: { success: true, event_id: "ev1" } });
    });
    await page.route("**/api/events/ev1/end", (route) => {
      calls.push(`end:${route.request().method()}`);
      return route.fulfill({ json: { success: true } });
    });
    await frigateApp.goto("/camera/front_door");
    await page
      .locator(".stage")
      .getByRole("button", { name: "Record now" })
      .click();
    await expect(
      page.locator(".stage").getByRole("button", { name: "Stop recording" }),
    ).toBeVisible();
    await page
      .locator(".stage")
      .getByRole("button", { name: "Stop recording" })
      .click();
    await expect.poll(() => calls).toEqual(["create", "end:PUT"]);
  });

  test("snapshot downloads a jpeg", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    const download = page.waitForEvent("download");
    await page
      .locator(".stage")
      .getByRole("button", { name: "Save snapshot" })
      .click();
    expect((await download).suggestedFilename()).toMatch(
      /^front_door_.*\.jpg$/,
    );
  });

  test("recordings get the playback bar with a speed picker", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const past = Math.floor(Date.now() / 1000) - 3600;
    await frigateApp.goto(`/camera/front_door?t=${past}`);
    const speed = page.getByRole("button", { name: "Playback speed" });
    await expect(speed).toHaveText("1x");
    await speed.click();
    await page.getByRole("menuitemradio", { name: "2x" }).click();
    await expect(speed).toHaveText("2x");
    await expect
      .poll(() =>
        page
          .locator(".stage__video")
          .evaluate((v: HTMLVideoElement) => [v.defaultPlaybackRate]),
      )
      .toEqual([2]);

    // going live resets the speed
    await page
      .getByRole("button", { name: "Live", exact: true })
      .first()
      .click();
    await expect(page.locator(".mode-badge--live")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Playback speed" }),
    ).toHaveCount(0);
  });

  test("the volume slider sets the recording volume", async ({
    frigateApp,
  }) => {
    test.skip(frigateApp.isMobile, "the slider collapses on narrow stages");
    const page = frigateApp.page;
    const past = Math.floor(Date.now() / 1000) - 3600;
    await frigateApp.goto(`/camera/front_door?t=${past}`);
    await page.getByRole("button", { name: "Unmute" }).first().click();
    await page.getByRole("slider", { name: "Volume" }).fill("0.5");
    await expect
      .poll(() =>
        page
          .locator(".stage__video")
          .evaluate((v: HTMLVideoElement) => v.volume),
      )
      .toBe(0.5);
  });

  test("actions export a clip", async ({ frigateApp }) => {
    const page = frigateApp.page;
    let exported = "";
    await page.route("**/api/export/front_door/start/**", (route) => {
      exported = route.request().url();
      return route.fulfill({ json: { success: true, export_id: "x" } });
    });
    await frigateApp.goto("/camera/front_door");
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitemradio", { name: "Export clip" }).click();
    await page.getByRole("radio", { name: "Last 4 hours" }).click();
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await expect(page.getByText("Export started")).toBeVisible();
    const [, start, end] = exported.match(/start\/(\d+)\/end\/(\d+)/)!;
    expect(Number(end) - Number(start)).toBe(4 * 3600);
  });

  test("side panel tabs switch between timeline, events and detail", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await expect(page.locator(".timeline")).toBeVisible();
    await page.getByRole("radio", { name: "Events" }).click();
    await expect(
      page.locator(".event-list .review-card").first(),
    ).toBeVisible();
    await expect(page.locator(".timeline")).toHaveCount(0);
    await page.getByRole("radio", { name: "Detail" }).click();
    await expect(page.locator(".review-detail")).toBeVisible();
    await page.getByRole("radio", { name: "Timeline" }).click();
    await expect(page.locator(".timeline")).toBeVisible();
  });

  test("filter and range change the review query", async ({ frigateApp }) => {
    const page = frigateApp.page;
    const urls: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/review\?/.test(request.url())) urls.push(request.url());
    });
    await frigateApp.goto("/camera/front_door");
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByRole("button", { name: "Person" }).click();
    await expect
      .poll(() => urls.some((u) => /labels=person/.test(u)))
      .toBe(true);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Last 24 hours" }).click();
    await page.getByRole("menuitemradio", { name: "Last 7 days" }).click();
    const weekAgo = Date.now() / 1000 - 7 * 24 * 3600;
    await expect
      .poll(() =>
        urls.some((u) => {
          const after = Number(new URL(u).searchParams.get("after"));
          return Math.abs(after - weekAgo) < 7200;
        }),
      )
      .toBe(true);
  });

  test("scrolling zooms the stage and double click resets", async ({
    frigateApp,
  }) => {
    test.skip(frigateApp.isMobile, "wheel zoom is a desktop gesture");
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    const stage = page.locator(".stage");
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -400);
    await expect(page.locator(".stage__zoom")).toBeVisible();
    await expect(page.locator(".stage__media")).toHaveAttribute(
      "style",
      /scale\(/,
    );
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(".stage__zoom")).toHaveCount(0);
  });
});
