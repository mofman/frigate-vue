import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/frigate-test";

test.describe("unified camera view", () => {
  test("starts live with the timeline handle at now", async ({
    frigateApp,
  }) => {
    await frigateApp.goto("/camera/front_door");
    await expect(frigateApp.page.locator(".mode-badge--live")).toBeVisible();
    await expect(
      frigateApp.page.locator(".handle.is-live .handle__pill"),
    ).toBeVisible();
  });

  test("scrubbing previews, then releases into recordings", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();
    const pill = page.locator(".handle__pill");
    await expect(pill).toBeVisible();
    const box = (await pill.boundingBox())!;

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 260, { steps: 8 });
    await expect(page.locator(".mode-badge--recording")).toContainText(
      /scrubbing/i,
    );
    // the stage must not have switched players mid drag
    await expect(page).not.toHaveURL(/t=/);
    await page.mouse.up();

    await expect(page.locator(".mode-badge--recording")).toContainText(
      /recording/i,
    );
    await expect(page).toHaveURL(/t=\d+/);
  });

  test("small drags near now stay live", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();
    const pill = page.locator(".handle__pill");
    const box = (await pill.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 1, {
      steps: 2,
    });
    await page.mouse.up();
    await expect(page.locator(".mode-badge--live")).toBeVisible();
    await expect(page).not.toHaveURL(/t=/);
  });

  test("the Live button returns from recordings", async ({ frigateApp }) => {
    const page = frigateApp.page;
    const anHourAgo = Math.floor(Date.now() / 1000) - 3600;
    await frigateApp.goto(`/camera/front_door?t=${anHourAgo}`);
    await expect(page.locator(".mode-badge--recording")).toBeVisible();
    await page
      .locator(".page-header")
      .getByRole("button", { name: "Live" })
      .click();
    await expect(page.locator(".mode-badge--live")).toBeVisible();
    await expect(page).not.toHaveURL(/t=/);
  });

  test("the camera strip follows the stage into recordings", async ({
    frigateApp,
  }, testInfo) => {
    // the strip is desktop only
    test.skip(testInfo.project.name === "mobile");
    const page = frigateApp.page;
    const anHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const otherCamera = page.waitForRequest(/api\/preview\/backyard\/start\//);
    await frigateApp.goto(`/camera/front_door?t=${anHourAgo}`);
    await expect(page.locator(".mode-badge--recording")).toBeVisible();
    await otherCamera;
  });

  test("switching cameras keeps the view mounted", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await expect(page.locator(".timeline")).toBeVisible();
    await page.evaluate(() => {
      (document.querySelector(".timeline") as HTMLElement).dataset.marker =
        "kept";
    });
    await page.locator(".camera-view__picker").click();
    await page.getByRole("menuitemradio", { name: /backyard/i }).click();
    await expect(page).toHaveURL(/\/camera\/backyard/);
    await expect(page.locator(".timeline")).toHaveAttribute(
      "data-marker",
      "kept",
    );
  });
});

test.describe("timeline scrolling", () => {
  const scrollTopOf = (page: Page) =>
    page.locator(".timeline__scroller").evaluate((el) => el.scrollTop);

  /** Wheel the timeline and wait for the scroll to come to rest. */
  async function wheelTimeline(page: Page, deltaY: number) {
    const box = (await page.locator(".timeline__scroller").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, deltaY);
    let last = -1;
    await expect
      .poll(async () => {
        const current = await scrollTopOf(page);
        const settled = current > 0 && current === last;
        last = current;
        return settled;
      })
      .toBe(true);
    return box;
  }

  /** viewport y of the playhead line */
  async function playheadY(page: Page) {
    const line = (await page.locator(".timeline .handle__line").boundingBox())!;
    return line.y + line.height / 2;
  }

  test("a click moves the playhead, not the timeline, while it is in view", async ({
    frigateApp,
  }) => {
    test.skip(frigateApp.isMobile, "click is a desktop gesture");
    const page = frigateApp.page;
    // two hours back: the timeline is scrolled down with the playhead in view,
    // which is when the browser picks the playhead as its scroll anchor
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    await frigateApp.goto(`/camera/front_door?t=${twoHoursAgo}`);
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();
    await expect(page.locator(".handle__pill")).toBeInViewport();
    expect(await scrollTopOf(page)).toBeGreaterThan(0);

    const box = (await page.locator(".timeline__scroller").boundingBox())!;
    for (const fraction of [0.6, 0.45, 0.75]) {
      const clickY = box.y + box.height * fraction;
      await page.mouse.click(box.x + 20, clickY);
      await page.waitForTimeout(400);
      expect(Math.abs((await playheadY(page)) - clickY)).toBeLessThan(3);
    }
  });

  test("a click after scrolling down puts the playhead there and the view stays", async ({
    frigateApp,
  }) => {
    test.skip(frigateApp.isMobile, "wheel and click are desktop gestures");
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();

    const box = await wheelTimeline(page, 1500);
    const clickY = box.y + box.height * 0.85;
    await page.mouse.click(box.x + 20, clickY);
    await expect(page.locator(".mode-badge--recording")).toBeVisible();

    // the old follow logic scrolled a low playhead up to 30% after release
    await page.waitForTimeout(1500);
    expect(Math.abs((await playheadY(page)) - clickY)).toBeLessThan(3);
  });

  test("holding a click near the bottom edge does not scroll", async ({
    frigateApp,
  }) => {
    test.skip(frigateApp.isMobile, "wheel and click are desktop gestures");
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();

    const box = await wheelTimeline(page, 600);
    const before = await scrollTopOf(page);
    // the zoom buttons fill most of the narrow column's bottom row: press the
    // track in the sliver beside them, which must still seek
    const zoomOut = (await page
      .getByRole("button", { name: /zoom out/i })
      .boundingBox())!;
    expect(zoomOut.x - box.x).toBeGreaterThan(4);
    await page.mouse.move((box.x + zoomOut.x) / 2, box.y + box.height - 20);
    await page.mouse.down();
    await page.waitForTimeout(300);
    await page.mouse.up();
    await expect(page.locator(".mode-badge--recording")).toBeVisible();
    await page.waitForTimeout(1000);

    // the anchor may step forward a row or two (8px each) as the clock ticks,
    // an edge auto-scroll would have moved it far more
    expect(Math.abs((await scrollTopOf(page)) - before)).toBeLessThanOrEqual(
      16,
    );
    // the playhead stays by the press, kept clear of the edge so its pill is
    // readable; the mock's fixture video lands a few seconds (a few px) off
    // the requested time, the old follow logic moved it to 30% of the height
    expect(
      Math.abs((await playheadY(page)) - (box.y + box.height - 16)),
    ).toBeLessThan(12);
  });

  test("scrolling the playhead away offers a way back to it", async ({
    frigateApp,
  }) => {
    test.skip(frigateApp.isMobile, "wheel is a desktop gesture");
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();
    const jump = page.getByRole("button", { name: /back to the playhead/i });
    await expect(jump).toHaveCount(0);

    await wheelTimeline(page, 2000);
    await expect(page.locator(".handle__pill")).not.toBeInViewport();
    // live stays live, the view just stops following it
    await expect(page.locator(".mode-badge--live")).toBeVisible();
    await expect(jump).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator(".handle__pill")).not.toBeInViewport();

    await jump.click();
    await expect(page.locator(".handle__pill")).toBeInViewport();
    await expect(jump).toHaveCount(0);
  });
});
