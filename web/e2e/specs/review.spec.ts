import { test, expect } from "../fixtures/frigate-test";

test.describe("review", () => {
  test("lists alerts and switches to detections", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/review");
    await expect(page.getByRole("tab", { name: /alerts/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: /detections/i }).click();
    await expect(
      page.getByRole("tab", { name: /detections/i }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("opening a card plays it in the camera view", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/review");
    await page
      .getByRole("switch", { name: /show reviewed/i })
      .check({ force: true });
    const card = page.locator(".review-card__media").first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/camera\/[a-z_]+\?t=\d+/);
    await expect(page.locator(".mode-badge--recording")).toBeVisible();
  });
});
