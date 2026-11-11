import { test, expect } from "../fixtures/frigate-test";

test.describe("camera dashboard", () => {
  test("shows a tile for every camera with a live count", async ({
    frigateApp,
  }) => {
    await frigateApp.goto("/");
    const tiles = frigateApp.page.locator(".camera-tile");
    await expect(tiles).toHaveCount(3);
    await expect(
      frigateApp.page.getByRole("heading", { name: "Cameras" }),
    ).toBeVisible();
    await expect(frigateApp.page.locator(".count-pill")).toContainText("live");
  });

  test("lists recent activity", async ({ frigateApp }) => {
    await frigateApp.goto("/");
    await expect(
      frigateApp.page.locator(".activity-item").first(),
    ).toBeVisible();
  });

  test("opening a tile goes to the camera view", async ({ frigateApp }) => {
    await frigateApp.goto("/");
    await frigateApp.page
      .getByRole("button", { name: /open front door/i })
      .click();
    await expect(frigateApp.page).toHaveURL(/\/camera\/front_door$/);
    await expect(frigateApp.page.locator(".stage")).toBeVisible();
  });

  test("legacy hash links open the camera", async ({ frigateApp }) => {
    await frigateApp.goto("/#backyard");
    await expect(frigateApp.page).toHaveURL(/\/camera\/backyard$/);
  });
});
