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
