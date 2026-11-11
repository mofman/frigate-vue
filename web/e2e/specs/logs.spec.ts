import { test, expect } from "../fixtures/frigate-test";

test.describe("logs", () => {
  test("shows parsed lines and filters by level", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/logs");
    const lines = page.locator(".log-line");
    await expect(lines).toHaveCount(3);
    await expect(lines.nth(0)).toContainText("Starting Frigate");
    await expect(lines.nth(2)).toHaveClass(/is-error/);

    await page.getByRole("button", { name: "Type" }).click();
    await page.getByRole("menuitemcheckbox", { name: "error" }).click();
    await page.keyboard.press("Escape");
    await expect(lines).toHaveCount(1);
    await expect(lines.first()).toContainText("Unable to write segment");
  });

  test("switches service through the hash", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/logs");
    const nginx = page.waitForRequest((request) =>
      request.url().includes("/api/logs/nginx"),
    );
    await page.getByRole("radio", { name: "nginx" }).click();
    await nginx;
    await expect(page).toHaveURL(/\/logs#nginx$/);
  });

  test("opens a line's details", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/logs");
    await page.locator(".log-line").nth(1).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("front_door: stream is slow");
    await expect(dialog).toContainText("frigate.video");
  });
});
