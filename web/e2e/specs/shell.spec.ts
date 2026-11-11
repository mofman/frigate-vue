import { test, expect } from "../fixtures/frigate-test";

test.describe("app shell", () => {
  test("navigation reaches review and back", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/");
    await page.getByRole("link", { name: "Review" }).click();
    await expect(page).toHaveURL(/\/review$/);
    await page.getByRole("link", { name: "Cameras" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("login page renders without the shell", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.locator(".sidebar")).toHaveCount(0);
  });
});

/** Desktop reaches the admin pages from the rail's settings cog, phones
 * from the account menu in the dock. */
function adminMenu(frigateApp: {
  isMobile: boolean;
  page: import("@playwright/test").Page;
}) {
  const name = frigateApp.isMobile ? "Account" : "Settings";
  return () => frigateApp.page.getByRole("button", { name }).click();
}

test.describe("admin menu", () => {
  test("admins reach system, logs and the config editor", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/");
    const open = adminMenu(frigateApp);

    await open();
    await page.getByRole("menuitem", { name: "Health and Metrics" }).click();
    await expect(page).toHaveURL(/\/system$/);

    await open();
    await page.getByRole("menuitem", { name: "Logs" }).click();
    await expect(page).toHaveURL(/\/logs$/);

    await open();
    await page.getByRole("menuitem", { name: "Configuration Editor" }).click();
    await expect(page).toHaveURL(/\/config$/);
  });

  test("restart asks first, then waits for Frigate", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/");
    await adminMenu(frigateApp)();
    await page.getByRole("menuitem", { name: "Restart Frigate" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      "Are you sure you want to restart Frigate?",
    );
    await dialog.getByRole("button", { name: "Restart" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Frigate is Restarting" }),
    ).toBeVisible();
  });

  test("viewers get a disabled settings entry and no admin items", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await frigateApp.installDefaults({
      profile: { username: "viewer", role: "viewer" },
    });
    await frigateApp.goto("/");
    if (!frigateApp.isMobile) {
      await expect(
        page.getByRole("button", { name: "Settings" }),
      ).toBeDisabled();
    }
    await page.getByRole("button", { name: "Account" }).click();
    await expect(page.getByRole("menuitem", { name: "Logs" })).toHaveCount(0);
  });
});
