import { test, expect } from "../fixtures/frigate-test";

const PTZ_INFO = {
  name: "front_door",
  features: ["pt", "zoom", "pt-r-fov", "zoom-r"],
  presets: ["driveway", "porch"],
  profiles: [],
};

test.describe("ptz controls", () => {
  test.beforeEach(async ({ frigateApp }) => {
    await frigateApp.api.install({
      config: { cameras: { front_door: { onvif: { host: "10.0.0.2" } } } },
    });
    await frigateApp.page.route("**/api/front_door/ptz/info", (route) =>
      route.fulfill({ json: PTZ_INFO }),
    );
  });

  const ptzSent = (frigateApp: {
    ws: { sent: { topic: string; payload?: unknown }[] };
  }) =>
    frigateApp.ws.sent
      .filter((m) => m.topic === "front_door/ptz")
      .map((m) => m.payload);

  test("holding an arrow moves until release", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await openPad(page);
    const left = page.getByRole("button", { name: "Pan left" });
    await expect(left).toBeVisible();
    const box = (await left.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect.poll(() => ptzSent(frigateApp)).toEqual(["MOVE_LEFT", "STOP"]);
  });

  test("presets and keyboard", async ({ frigateApp }) => {
    test.skip(frigateApp.isMobile, "keyboard only on desktop");
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await page.getByRole("button", { name: "Presets" }).click();
    await page.getByRole("menuitemradio", { name: /porch/ }).click();
    await page.keyboard.down("ArrowUp");
    await page.keyboard.up("ArrowUp");
    await page.keyboard.press("1");
    await expect
      .poll(() => ptzSent(frigateApp))
      .toEqual(["preset_porch", "MOVE_UP", "STOP", "preset_driveway"]);
  });

  test("click to move sends a relative move", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await frigateApp.goto("/camera/front_door");
    await openPad(page);
    await page
      .getByRole("button", { name: "Click to move, drag a box to zoom" })
      .click();
    const layer = page.locator(".ptz-click-layer");
    const box = (await layer.boundingBox())!;
    // the upper left quarter is clear of the pad on every stage size
    await page.mouse.click(box.x + box.width / 4, box.y + box.height / 4);
    await expect
      .poll(() => ptzSent(frigateApp).at(-1))
      .toBe("move_relative_-0.5_0.5");
  });

  test("cameras without onvif show no ptz pad", async ({ frigateApp }) => {
    await frigateApp.goto("/camera/backyard");
    await expect(
      page(frigateApp).getByRole("button", { name: "Pan left" }),
    ).toHaveCount(0);
  });
});

function page(app: { page: import("@playwright/test").Page }) {
  return app.page;
}

/** small stages fold the pad behind the PTZ button */
async function openPad(page: import("@playwright/test").Page) {
  const toggle = page.getByRole("button", { name: "PTZ controls" });
  await page.getByRole("group", { name: "PTZ controls" }).waitFor();
  if (await toggle.isVisible()) await toggle.click();
}
