/** First run setup wizard: when it appears and what each step saves. */
import type { Page, Request } from "@playwright/test";
import { test, expect } from "../fixtures/frigate-test";
import { configFactory } from "../fixtures/mock-data/config";
import { viewerProfile } from "../fixtures/mock-data/profile";

const DISMISSED_KEY = "frigate-setup-dismissed";

async function mockNoCameras(page: Page, auth?: { enabled: boolean }) {
  const config = { ...configFactory(), cameras: {}, ...(auth && { auth }) };
  await page.route("**/api/config", (route) => route.fulfill({ json: config }));
}

const next = (page: Page) =>
  page.getByRole("button", { name: "Next", exact: true }).click();
const heading = (page: Page, name: string) =>
  expect(page.getByRole("heading", { name })).toBeVisible();

function configWrites(page: Page) {
  const writes: Record<string, unknown>[] = [];
  page.on("request", (request: Request) => {
    if (request.url().includes("/api/config/set")) {
      writes.push(request.postDataJSON().config_data);
    }
  });
  return writes;
}

test.describe("setup wizard entry", () => {
  test("sends an admin with no cameras to setup", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await mockNoCameras(page);
    await page.goto("/");
    await heading(page, "Welcome to Frigate");
    await expect(page).toHaveURL(/\/setup$/);
  });

  test("leaves a viewer on the dashboard", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await mockNoCameras(page);
    await page.route("**/profile", (route) =>
      route.fulfill({ json: viewerProfile() }),
    );
    await frigateApp.goto("/");
    await expect(page.getByText("No cameras are configured")).toBeVisible();
    await expect(page).not.toHaveURL(/\/setup$/);
    await expect(
      page.getByRole("button", { name: "Set up Frigate" }),
    ).toHaveCount(0);
  });

  test("leaves an install with cameras alone", async ({ frigateApp }) => {
    await frigateApp.goto("/");
    await expect(frigateApp.page).not.toHaveURL(/\/setup$/);
  });

  test("skipping stays dismissed and setup can be reopened", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await mockNoCameras(page);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Skip setup and configure manually" })
      .click();
    const reopen = page.getByRole("button", { name: "Set up Frigate" });
    await expect(reopen).toBeVisible();
    await expect(page).not.toHaveURL(/\/setup$/);
    expect(
      await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY),
    ).toBe("true");
    await reopen.click();
    await heading(page, "Welcome to Frigate");
  });
});

test.describe("setup wizard steps", () => {
  test("hides the account step when auth is off", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await mockNoCameras(page, { enabled: false });
    await page.goto("/setup");
    await page.getByRole("button", { name: "Get Started" }).click();
    await heading(page, "Add Your First Camera");
  });

  test("sets the admin password", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await mockNoCameras(page);
    await page.goto("/setup");
    await page.getByRole("button", { name: "Get Started" }).click();
    await page.getByRole("button", { name: "Change password" }).click();

    const dialog = page.getByRole("dialog");
    const save = dialog.getByRole("button", { name: "Save" });
    await dialog.getByLabel("New Password").fill("short");
    await save.click();
    await expect(dialog.getByRole("alert").first()).toContainText("12");

    await dialog.getByLabel("New Password").fill("a-long-password");
    await dialog.getByLabel("Confirm Password").fill("a-long-password");
    const request = page.waitForRequest(
      (r) => r.url().includes("/password") && r.method() === "PUT",
    );
    await save.click();
    expect((await request).postDataJSON()).toEqual({
      password: "a-long-password",
    });
    await expect(page.getByText("Password set")).toBeVisible();
  });

  test("saves each choice and restarts at the end", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await mockNoCameras(page);
    const writes = configWrites(page);
    await page.goto("/setup");
    await page.getByRole("button", { name: "Get Started" }).click();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await heading(page, "Add Your First Camera");
    await page.getByRole("button", { name: "Skip", exact: true }).click();

    await heading(page, "Object Detection");
    await page.getByRole("radio", { name: /Intel GPU/ }).check();
    await next(page);

    await heading(page, "Hardware Acceleration");
    await page.getByRole("radio", { name: /None/ }).check();
    await next(page);

    await heading(page, "Recordings");
    await page.getByRole("radio", { name: /All the time/ }).check();
    await page.getByLabel("Keep recordings for (days)").fill("5");
    await next(page);

    await heading(page, "You're done!");
    expect(writes).toEqual([
      {
        models: [{ devices: ["openvino:GPU.0"] }],
        detect: { enabled: true },
      },
      { ffmpeg: { hwaccel_args: [] } },
      {
        record: {
          enabled: true,
          alerts: { retain: { days: 5 } },
          detections: { retain: { days: 5 } },
          continuous: { days: 5 },
        },
      },
    ]);

    const restart = page.waitForRequest(
      (r) => r.url().endsWith("/api/restart") && r.method() === "POST",
    );
    await page.getByRole("button", { name: "Apply & Restart" }).click();
    await restart;
  });

  test("goes back without losing a choice", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await mockNoCameras(page);
    await page.goto("/setup");
    await page.getByRole("button", { name: "Get Started" }).click();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await page.getByRole("radio", { name: /^CPU/ }).check();
    await page.getByRole("button", { name: "Back" }).click();
    await heading(page, "Add Your First Camera");
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(page.getByRole("radio", { name: /^CPU/ })).toBeChecked();
  });

  test("finishes without a restart when nothing needs one", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await mockNoCameras(page);
    let restarted = false;
    await page.route("**/api/restart", (route) => {
      restarted = true;
      return route.fulfill({ json: { success: true } });
    });
    await page.goto("/setup");
    await page.getByRole("button", { name: "Get Started" }).click();
    for (const title of [
      "Secure your account",
      "Add Your First Camera",
      "Object Detection",
      "Hardware Acceleration",
      "Recordings",
    ]) {
      await heading(page, title);
      await page.getByRole("button", { name: "Skip", exact: true }).click();
    }
    await page.getByRole("button", { name: "Go to Live View" }).click();
    await expect(page).not.toHaveURL(/\/setup$/);
    expect(restarted).toBe(false);
  });
});
