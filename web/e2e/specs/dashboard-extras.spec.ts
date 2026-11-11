import { test, expect } from "../fixtures/frigate-test";

test.describe("dashboard extras", () => {
  test("camera groups filter the tiles and update the url", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/");
    await expect(page.locator(".camera-tile")).toHaveCount(3);
    await page.getByRole("button", { name: "Camera group" }).click();
    await page.getByRole("menuitemradio", { name: "outdoor" }).click();
    await expect(page.locator(".camera-tile")).toHaveCount(2);
    await expect(page).toHaveURL(/group=outdoor/);

    await page.goto("/");
    // the choice is remembered
    await expect(page.locator(".camera-tile")).toHaveCount(2);
  });

  test("admins can save a camera group", async ({ frigateApp }) => {
    const page = frigateApp.page;
    let query = "";
    await page.route(/\/api\/config\/set\?/, (route) => {
      query = decodeURIComponent(new URL(route.request().url()).search);
      return route.fulfill({ json: { success: true } });
    });
    await frigateApp.goto("/");
    await page.getByRole("button", { name: "Camera group" }).click();
    await page.getByRole("menuitemradio", { name: "Edit groups" }).click();
    await page.getByRole("button", { name: "New group" }).click();
    await page.getByLabel("Name").fill("driveway");
    await page.getByRole("checkbox", { name: "Garage" }).check();
    await page.getByRole("button", { name: "Save group" }).click();
    await expect
      .poll(() => query)
      .toContain("camera_groups.driveway.cameras=garage");
  });

  test("tile menu turns a camera off and snoozes notifications", async ({
    frigateApp,
  }) => {
    await frigateApp.api.install({
      config: {
        cameras: {
          front_door: {
            notifications: { enabled: true, enabled_in_config: true },
          },
        },
      },
    });
    const page = frigateApp.page;
    await frigateApp.goto("/");
    frigateApp.ws.send("front_door/notifications/state", "ON");
    const tile = page.locator(".camera-tile").first();
    await tile.click({ button: "right" });
    await page
      .getByRole("menuitemradio", { name: "Suspend for 12 hours" })
      .click();
    await tile.click({ button: "right" });
    await page.getByRole("menuitemradio", { name: "Disable camera" }).click();
    // menu clicks must not open the camera behind them
    await expect(page).toHaveURL(/\/(\?.*)?$/);

    const sent = frigateApp.ws.sent.filter((m) =>
      m.topic.startsWith("front_door/"),
    );
    expect(sent).toContainEqual({
      topic: "front_door/enabled/set",
      payload: "OFF",
    });
    expect(sent).toContainEqual({
      topic: "front_door/notifications/suspend",
      payload: 720,
    });
  });

  test("the activity filter narrows the review query", async ({
    frigateApp,
  }) => {
    test.skip(frigateApp.isMobile, "the activity panel is desktop only");
    const page = frigateApp.page;
    const urls: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/review\?/.test(r.url())) urls.push(r.url());
    });
    await frigateApp.goto("/");
    await page
      .locator(".activity-panel")
      .getByRole("button", { name: "Filter" })
      .click();
    await page.getByRole("radio", { name: "Alerts" }).click();
    await expect
      .poll(() =>
        urls.some((u) => /severity=alert/.test(u) && /limit=20/.test(u)),
      )
      .toBe(true);
  });
});
