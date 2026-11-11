import { test, expect } from "../fixtures/frigate-test";

test.describe("config editor", () => {
  test("loads the raw config and saves it as plain text", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await page.route("**/api/config/save**", (route) =>
      route.fulfill({
        json: { success: true, message: "Config successfully saved." },
      }),
    );
    await frigateApp.goto("/config");
    const editor = page.locator(".cm-content");
    await expect(editor).toContainText("front_door:");
    // the JSON encoded body is decoded into real lines, not shown quoted
    await expect(page.locator(".cm-line")).toHaveCount(6);
    await expect(editor).not.toContainText('"mqtt');

    const save = page.waitForRequest(
      (request) =>
        request.url().includes("/api/config/save") &&
        request.method() === "POST",
    );
    await editor.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("\n# edited");
    await page.getByRole("button", { name: "Save Only" }).click();
    const request = await save;

    expect(request.url()).toContain("save_option=saveonly");
    expect(request.headers()["content-type"]).toBe("text/plain");
    expect(request.postData()).toContain("# edited");
    await expect(page.getByText("Config successfully saved.")).toBeVisible();
  });

  test("shows the server's validation error", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await page.route("**/api/config/save**", (route) =>
      route.fulfill({
        status: 400,
        json: { success: false, message: "cameras.front_door: invalid input" },
      }),
    );
    await frigateApp.goto("/config");
    await expect(page.locator(".cm-content")).toContainText("front_door:");
    await page.getByRole("button", { name: "Save Only" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "cameras.front_door: invalid input",
    );
  });
});
