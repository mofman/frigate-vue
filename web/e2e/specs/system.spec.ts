import { test, expect } from "../fixtures/frigate-test";

test.describe("system", () => {
  test("opens on health and switches tabs through the hash", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/system");
    await expect(page.getByRole("radio", { name: "Health" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(
      page.getByText("Your Frigate installation is healthy"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Hardware", exact: true }),
    ).toBeVisible();

    await page.getByRole("radio", { name: "General" }).click();
    await expect(page).toHaveURL(/\/system#general$/);
    await expect(
      page.getByRole("heading", { name: "Detector Inference Speed" }),
    ).toBeVisible();
    // the mock detector runs at 75.5 ms, past the 50 ms warning line
    await expect(
      page.locator(".threshold-chart__value.is-warning").first(),
    ).toHaveText("75.5ms");
  });

  test("storage tab shows disks and the per camera table", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/system#storage");
    await expect(page.getByRole("heading", { name: "/dev/shm" })).toBeVisible();
    await expect(page.getByRole("cell", { name: /front door/i })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Other" })).toBeVisible();
  });

  test("cameras tab charts each camera", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/system#cameras");
    await expect(
      page.getByRole("heading", { name: "Frames / Detections" }).first(),
    ).toBeVisible();
    await expect(page.locator(".line-chart path").first()).toHaveAttribute(
      "d",
      /^M/,
    );
  });

  test("status bar chips link to the matching tab", async ({ frigateApp }) => {
    test.skip(frigateApp.isMobile, "the status bar is hidden on phones");
    const page = frigateApp.page;
    await frigateApp.goto("/");
    await page.locator(".status-chip", { hasText: "Storage" }).click();
    await expect(page).toHaveURL(/\/system#storage$/);
    await expect(page.getByRole("radio", { name: "Storage" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("viewers are sent back to the dashboard", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.installDefaults({
      profile: { username: "viewer", role: "viewer" },
    });
    await frigateApp.goto("/system");
    await expect(page).toHaveURL(/\/$/);
  });
});
