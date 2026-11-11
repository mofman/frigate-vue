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
