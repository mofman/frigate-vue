/** Add Camera wizard, reached from the setup wizard's camera step. */
import type { Page, Request } from "@playwright/test";
import { test, expect } from "../fixtures/frigate-test";
import { configFactory } from "../fixtures/mock-data/config";

async function openWizard(page: Page) {
  const config = { ...configFactory(), cameras: {} };
  await page.route("**/api/config", (route) => route.fulfill({ json: config }));
  await page.goto("/setup");
  await page.getByRole("button", { name: "Get Started" }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Add Camera", exact: true }).click();
  return page.getByRole("dialog");
}

function recordRequests(page: Page) {
  const configs: Record<string, unknown>[] = [];
  const streams: string[] = [];
  page.on("request", (request: Request) => {
    const url = request.url();
    if (url.includes("/api/config/set")) configs.push(request.postDataJSON());
    if (url.includes("/api/go2rtc/streams/")) {
      streams.push(`${request.method()} ${new URL(url).pathname}`);
    }
  });
  return { configs, streams };
}

test.describe("add camera wizard", () => {
  test("adds a camera from a custom url", async ({ frigateApp }) => {
    const page = frigateApp.page;
    const { configs, streams } = recordRequests(page);
    const dialog = await openWizard(page);

    await dialog.getByLabel("Camera Name").fill("Front Door");
    await dialog.getByRole("radio", { name: "Manual selection" }).check();
    await dialog.getByLabel("Camera Brand").selectOption("other");
    await dialog
      .getByLabel("Custom Stream URL")
      .fill("rtsp://admin:secret@192.168.1.20/main");
    await dialog.getByRole("button", { name: "Continue" }).click();

    await expect(dialog.getByText("Connection test successful!")).toBeVisible();
    await dialog.getByRole("button", { name: "Continue" }).click();

    await expect(dialog.getByText("Stream 1")).toBeVisible();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();

    await expect(dialog.getByText("rtsp://admin:****@")).toBeVisible();
    await expect(dialog.getByText("secret")).toHaveCount(0);
    await expect
      .poll(() => streams.some((entry) => entry.startsWith("PUT")))
      .toBe(true);
    await dialog.getByRole("button", { name: "Save New Camera" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText("front_door")).toBeVisible();
    expect(configs[0]).toMatchObject({
      requires_restart: 1,
      update_topic: "config/cameras/front_door/add",
      config_data: {
        cameras: {
          front_door: {
            friendly_name: "Front Door",
            detect: { width: 1280, height: 720 },
            ffmpeg: {
              inputs: [
                {
                  path: "rtsp://admin:secret@192.168.1.20/main",
                  roles: ["detect"],
                },
              ],
            },
          },
        },
      },
    });
    expect(configs[1]).toMatchObject({
      requires_restart: 0,
      config_data: {
        go2rtc: {
          streams: { front_door: ["rtsp://admin:secret@192.168.1.20/main"] },
        },
      },
    });
    // the preview's temporary stream is gone and the real one is registered
    await expect
      .poll(() =>
        streams.some((entry) => /^DELETE .*\/wizard_stream_/.test(entry)),
      )
      .toBe(true);
    expect(streams).toContain("PUT /api/go2rtc/streams/front_door");
  });

  test("finds streams with an ONVIF probe", async ({ frigateApp }) => {
    const page = frigateApp.page;
    const dialog = await openWizard(page);
    await dialog.getByLabel("Camera Name").fill("garage");
    await dialog.getByLabel("Host/IP Address").fill("192.168.1.20");
    await dialog.getByLabel("Username").fill("admin");
    const probe = page.waitForRequest((r) =>
      r.url().includes("/api/onvif/probe"),
    );
    await dialog.getByRole("button", { name: "Continue" }).click();
    expect(new URL((await probe).url()).searchParams.get("host")).toBe(
      "192.168.1.20",
    );

    await expect(dialog.getByText("Acme")).toBeVisible();
    await expect(dialog.getByText("Candidate 2")).toBeVisible();
    await expect(dialog.getByText("secret")).toHaveCount(0);
    await dialog
      .getByRole("button", { name: "Test Connection" })
      .first()
      .click();
    await expect(dialog.getByText("Connected", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();

    await expect(dialog.getByLabel("URL")).toHaveValue(/\/main$/);
    await dialog.getByRole("button", { name: "Add Another Stream" }).click();
    await expect(dialog.getByLabel("URL").nth(1)).toHaveValue(/\/sub$/);
  });

  test("rejects a name already in use", async ({ frigateApp }) => {
    const page = frigateApp.page;
    const config = configFactory();
    await page.route("**/api/config", (route) =>
      route.fulfill({
        json: { ...config, cameras: { front_door: config.cameras.front_door } },
      }),
    );
    await page.goto("/setup");
    await page.getByRole("button", { name: "Get Started" }).click();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await page.getByRole("button", { name: "Add Camera", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Camera Name").fill("Front Door");
    await dialog.getByLabel("Host/IP Address").fill("192.168.1.20");
    await dialog.getByRole("button", { name: "Continue" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Camera name already exists",
    );
  });
});
