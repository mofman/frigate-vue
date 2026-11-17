/**
 * Export: picking a clip on the timeline, the export bar, one-click event
 * export, and the Exports page.
 */
import { test, expect } from "../fixtures/frigate-test";
import { PLACEHOLDER_PNG } from "../helpers/api-mocker";

const past = () => Math.floor(Date.now() / 1000) - 3600;

test.beforeEach(async ({ frigateApp }) => {
  await frigateApp.page.route("**/exports/*.jpg", (route) =>
    route.fulfill({ contentType: "image/png", body: PLACEHOLDER_PNG }),
  );
});

test.describe("export selection", () => {
  test("picks a clip from the actions menu and exports it", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    let url = "";
    let body: Record<string, unknown> = {};
    await page.route("**/api/export/front_door/start/**", (route) => {
      url = route.request().url();
      body = route.request().postDataJSON();
      return route.fulfill({ json: { success: true, export_id: "x" } });
    });
    await frigateApp.goto(`/camera/front_door?t=${past()}`);
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitemradio", { name: "Export clip" }).click();

    const bar = page.locator(".export-bar");
    await expect(bar).toBeVisible();
    await expect(page.locator(".timeline .selection")).toBeVisible();

    await bar.getByRole("button", { name: "5 min" }).click();
    await expect(bar.locator(".export-bar__duration")).toHaveText("5m 0s");
    await bar.getByRole("textbox", { name: "Name" }).fill("Driveway");
    await bar.getByRole("radio", { name: "Main" }).click();
    await bar.getByRole("button", { name: "Export", exact: true }).click();

    await expect(page.getByText("Export started")).toBeVisible();
    await expect(bar).toBeHidden();
    const [, start, end] = url.match(/start\/(\d+)\/end\/(\d+)/)!;
    expect(Number(end) - Number(start)).toBe(300);
    expect(body).toMatchObject({
      source: "recordings",
      name: "Driveway",
      stream: "main",
    });
  });

  test("dragging a grip changes the range", async ({ frigateApp }) => {
    test.skip(frigateApp.isMobile, "mouse drag");
    const page = frigateApp.page;
    await frigateApp.goto(`/camera/front_door?t=${past()}`);
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();
    await page.keyboard.press("e");
    const duration = page.locator(".export-bar__duration");
    await expect(duration).toHaveText("1m 0s");

    const grip = page.getByRole("button", { name: /^Clip start/ });
    const box = (await grip.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 90, { steps: 6 });
    await page.mouse.up();
    await expect(duration).not.toHaveText("1m 0s");
    // the start moved back in time, so the clip got longer
    await expect(duration).toHaveText(/^[2-9]m /);
  });

  test("keyboard: E opens, I and O set the edges, Escape cancels", async ({
    frigateApp,
  }) => {
    test.skip(frigateApp.isMobile, "keyboard");
    const page = frigateApp.page;
    await frigateApp.goto(`/camera/front_door?t=${past()}`);
    await expect(page.locator(".timeline[data-ready]")).toBeVisible();
    await page.keyboard.press("e");
    const bar = page.locator(".export-bar");
    await expect(bar).toBeVisible();

    // the playhead sits mid clip, so cutting the end there halves it
    await page.keyboard.press("o");
    await expect(bar.locator(".export-bar__duration")).toHaveText(/^3\ds$/);

    await page.keyboard.press("Escape");
    await expect(bar).toBeHidden();
    await expect(page).toHaveURL(/\/camera\/front_door/);
  });

  test("several cameras export as one batch", async ({ frigateApp }) => {
    const page = frigateApp.page;
    let body: { items?: { camera: string }[]; new_case_name?: string } = {};
    await page.route("**/api/exports/batch", (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({
        status: 202,
        json: { export_case_id: "c1", export_ids: ["a", "b"], results: [] },
      });
    });
    await frigateApp.goto(`/camera/front_door?t=${past()}`);
    await page.getByRole("button", { name: "Actions" }).click();
    await page.getByRole("menuitemradio", { name: "Export clip" }).click();

    const bar = page.locator(".export-bar");
    await bar.getByRole("button", { name: "Add cameras" }).click();
    await page.getByRole("menuitemradio", { name: /backyard/i }).click();
    await page.keyboard.press("Escape");
    await bar.getByRole("button", { name: "Export 2 cameras" }).click();

    await expect(page.getByText("2 exports started")).toBeVisible();
    expect(body.items?.map((item) => item.camera)).toEqual([
      "front_door",
      "backyard",
    ]);
    expect(body.new_case_name).toBeTruthy();
  });

  test("a review card exports its event", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/review");
    await page
      .getByRole("switch", { name: /show reviewed/i })
      .check({ force: true });
    await page
      .getByRole("button", { name: "Export this event" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/camera\/[a-z_]+\?t=\d+/);
    await expect(page.locator(".export-bar")).toBeVisible();
    // the deep link is consumed once the selection is open
    await expect(page).not.toHaveURL(/export=/);
  });
});

test.describe("exports page", () => {
  test("lists exports, grouped by case, with live progress", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/export");
    await expect(
      page.getByRole("heading", { name: "Front Door - Person Alert" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Package Theft Investigation" }),
    ).toBeVisible();

    frigateApp.ws.send(
      "job_state",
      JSON.stringify({
        export: {
          job_type: "export",
          status: "running",
          results: {
            jobs: [
              {
                id: "export-003",
                job_type: "export",
                status: "running",
                camera: "garage",
                name: "Garage - In Progress",
                request_start_time: 0,
                request_end_time: 60,
                current_step: "encoding",
                progress_percent: 42,
              },
            ],
          },
        },
      }),
    );
    await expect(page.getByText("Encoding · 42%")).toBeVisible();
  });

  test("search narrows the list", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/export");
    await page.getByRole("searchbox", { name: "Search exports" }).fill("car");
    await expect(
      page.getByRole("heading", { name: "Backyard - Car Detection" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Front Door - Person Alert" }),
    ).toBeHidden();
  });

  test("rename and delete call the api", async ({ frigateApp }) => {
    const page = frigateApp.page;
    let renamed: unknown;
    let deleted: unknown;
    await page.route("**/api/export/export-001/rename", (route) => {
      renamed = route.request().postDataJSON();
      return route.fulfill({ json: { success: true } });
    });
    await page.route("**/api/exports/delete", (route) => {
      deleted = route.request().postDataJSON();
      return route.fulfill({ json: { success: true } });
    });
    await frigateApp.goto("/export");
    const card = page
      .locator(".export-card")
      .filter({ hasText: "Front Door - Person Alert" });

    await card.getByRole("button", { name: "Rename export" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("Porch visitor");
    await page.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => renamed).toEqual({ name: "Porch visitor" });

    await card.getByRole("button", { name: "Delete export" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete export" })
      .click();
    await expect.poll(() => deleted).toEqual({ ids: ["export-001"] });
  });
});
