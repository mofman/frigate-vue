/**
 * Explore: the label summary, filters kept in the URL, both paging modes,
 * search, selection and the tracked object dialog.
 */
import type { Page } from "@playwright/test";
import { test, expect } from "../fixtures/frigate-test";
import { viewerProfile } from "../fixtures/mock-data/profile";

const NOW = 1_780_000_000;
const PAGE_SIZE = 25;

type MockEvent = ReturnType<typeof makeEvent>;

function makeEvent(index: number, label = "person") {
  return {
    id: `${NOW - index}.5-event${index}`,
    label,
    sub_label: null as string | null,
    camera: "front_door",
    start_time: NOW - index * 60,
    end_time: NOW - index * 60 + 20,
    false_positive: false,
    zones: [] as string[],
    has_clip: true,
    has_snapshot: true,
    retain_indefinitely: false,
    plus_id: null,
    top_score: 0.9,
    search_distance: 0.2,
    search_source: "thumbnail",
    data: {
      type: "object",
      score: 0.9 - index / 1000,
      top_score: 0.92,
      box: [0.2, 0.2, 0.2, 0.4],
      description: `Description ${index}`,
      path_data: [[[0.3, 0.6], NOW - index * 60 + 1]],
    },
  };
}

const makeEvents = (count: number) =>
  Array.from({ length: count }, (_, index) => makeEvent(index));

/** Answers the events endpoints the way the server pages them. */
async function mockEvents(page: Page, events: MockEvent[]) {
  const requests: URL[] = [];
  const deleted: unknown[] = [];
  let rows = events;

  await page.route(/\/api\/events(\/[^/?]*)?(\?.*)?$/, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const name = url.pathname.split("/api/events")[1]?.replace("/", "") ?? "";

    if (request.method() === "DELETE") {
      const ids = name ? [name] : request.postDataJSON().event_ids;
      deleted.push(ids);
      rows = rows.filter((event) => !ids.includes(event.id));
      return route.fulfill({ json: { success: true } });
    }
    if (name === "explore") {
      return route.fulfill({
        json: rows.slice(0, 4).map((event) => ({
          ...event,
          event_count: rows.length,
        })),
      });
    }
    if (name && name !== "search") {
      const event = rows.find((item) => item.id === decodeURIComponent(name));
      return event
        ? route.fulfill({ json: event })
        : route.fulfill({ status: 404, json: { success: false } });
    }

    requests.push(url);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const before = url.searchParams.get("before");
    const matching = rows
      .filter((event) => !before || event.start_time < Number(before))
      .filter(
        (event) =>
          !url.searchParams.get("labels") ||
          url.searchParams.get("labels")!.split(",").includes(event.label),
      );
    return route.fulfill({ json: matching.slice(offset, offset + limit) });
  });

  await page.route("**/api/event_ids**", (route) =>
    route.fulfill({
      json: rows.filter((event) =>
        new URL(route.request().url()).searchParams
          .get("ids")
          ?.split(",")
          .includes(event.id),
      ),
    }),
  );
  await page.route("**/api/timeline**", (route) => {
    const id = new URL(route.request().url()).searchParams.get("source_id");
    const event = rows.find((item) => item.id === id);
    if (!event) return route.fulfill({ json: [] });
    const step = (offset: number, class_type: string) => ({
      camera: event.camera,
      timestamp: event.start_time + offset,
      source: "tracked_object",
      source_id: event.id,
      class_type,
      data: {
        camera: event.camera,
        label: event.label,
        box: [0.2, 0.2, 0.2, 0.4],
        zones: [],
        score: 0.8,
      },
    });
    return route.fulfill({ json: [step(1, "visible"), step(9, "gone")] });
  });

  return { requests, deleted };
}

const cards = (page: Page) => page.locator(".explore-card");

test.describe("explore summary", () => {
  test("groups objects by label and links to the label", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await mockEvents(page, [makeEvent(0), makeEvent(1), makeEvent(2, "car")]);
    await frigateApp.goto("/explore");

    const sections = page.locator(".explore-summary__row");
    await expect(sections).toHaveCount(2);
    await expect(sections.first()).toContainText("3 tracked objects");
    await sections
      .filter({ hasText: /car/i })
      .getByRole("link", { name: /explore more/i })
      .click();

    await expect(page).toHaveURL(/\/explore\?labels=car$/);
    await expect(cards(page)).toHaveCount(1);
  });

  test("shows the empty state", async ({ frigateApp }) => {
    await mockEvents(frigateApp.page, []);
    await frigateApp.goto("/explore");
    await expect(
      frigateApp.page.getByText("No Tracked Objects Found"),
    ).toBeVisible();
  });

  test("offers a retry when loading fails", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await mockEvents(page, [makeEvent(0)]);
    let fail = true;
    let failures = 0;
    await page.route("**/api/events/explore**", (route) => {
      if (!fail) return route.fallback();
      failures++;
      return route.fulfill({ status: 500, json: { success: false } });
    });
    await frigateApp.goto("/explore");
    await expect(page.getByText("could not be loaded")).toBeVisible();
    // a failed load waits for the user instead of retrying in a loop
    await page.waitForTimeout(300);
    expect(failures).toBe(1);
    fail = false;
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(cards(page)).toHaveCount(1);
  });
});

test.describe("explore results", () => {
  test("restores filters from the URL and clears them with chips", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const { requests } = await mockEvents(page, [
      makeEvent(0),
      makeEvent(1, "car"),
    ]);
    await frigateApp.goto("/explore?labels=car&min_score=0.8");

    await expect(cards(page)).toHaveCount(1);
    expect(requests.at(-1)!.searchParams.get("min_score")).toBe("0.8");

    await page.getByRole("button", { name: /clear labels/i }).click();
    await expect(page).toHaveURL(/\/explore\?min_score=0\.8$/);
    await expect(cards(page)).toHaveCount(2);
  });

  test("loads more by start time without repeating objects", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const events = makeEvents(60);
    const { requests } = await mockEvents(page, events);
    await frigateApp.goto("/explore?cameras=front_door");
    await expect(cards(page)).toHaveCount(PAGE_SIZE);

    await page.locator(".explore-grid__more").scrollIntoViewIfNeeded();
    await expect(cards(page)).toHaveCount(PAGE_SIZE * 2);
    expect(requests[1]!.searchParams.get("before")).toBe(
      String(events[PAGE_SIZE - 1]!.start_time),
    );
    expect(requests[1]!.searchParams.get("offset")).toBeNull();

    const ids = await cards(page).evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).dataset.eventId),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("keeps filter button icons beside their text", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await mockEvents(page, makeEvents(1));
    await frigateApp.goto("/explore?cameras=front_door");
    await expect(cards(page)).toHaveCount(1);

    for (const name of ["Labels", "Dates"]) {
      const button = page.getByRole("button", { name, exact: true });
      const height = await button.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      const icon = await button
        .locator("svg")
        .evaluate((element) => element.getBoundingClientRect());
      const text = await button
        .locator(".icon-button__label")
        .evaluate((element) => element.getBoundingClientRect());
      expect(height).toBe(34);
      expect(icon.right).toBeLessThanOrEqual(text.left);
    }
  });

  test("loads more by offset for other sorts", async ({ frigateApp }) => {
    const page = frigateApp.page;
    const { requests } = await mockEvents(page, makeEvents(40));
    await frigateApp.goto("/explore?sort=score_desc");
    await expect(cards(page)).toHaveCount(PAGE_SIZE);
    await page.locator(".explore-grid__more").scrollIntoViewIfNeeded();
    await expect(cards(page)).toHaveCount(40);
    expect(requests[1]!.searchParams.get("offset")).toBe(String(PAGE_SIZE));
    expect(requests[1]!.searchParams.get("before")).toBeNull();
  });

  test("deletes selected objects after confirming", async ({ frigateApp }) => {
    const page = frigateApp.page;
    const events = makeEvents(3);
    const { deleted } = await mockEvents(page, events);
    await frigateApp.goto("/explore?cameras=front_door");
    await expect(cards(page)).toHaveCount(3);

    const media = page.locator(".explore-card__media");
    await media.nth(0).click({ button: "right" });
    await media.nth(1).click();
    await expect(page.getByText("2 selected")).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page
      .getByRole("dialog")
      .filter({ hasText: "Confirm Delete" });
    await expect(dialog).toContainText("2 tracked objects");
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(cards(page)).toHaveCount(1);
    expect(deleted).toEqual([[events[0]!.id, events[1]!.id]]);
  });

  test("viewers cannot delete or edit", async ({ frigateApp }) => {
    await frigateApp.installDefaults({ profile: viewerProfile() });
    const page = frigateApp.page;
    await mockEvents(page, makeEvents(2));
    await frigateApp.goto("/explore?cameras=front_door");

    await page.locator(".explore-card__media").first().click({
      button: "right",
    });
    await expect(page.getByText("1 selected")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await page.keyboard.press("Escape");
    await page.locator(".explore-card__media").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Description 0")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
  });
});

test.describe("explore object dialog", () => {
  test("opens in the URL, steps between objects and closes with back", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const events = makeEvents(3);
    await mockEvents(page, events);
    await frigateApp.goto("/explore?cameras=front_door");

    await page.locator(".explore-card__media").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Description 0")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`id=${events[0]!.id}`));

    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByText("Description 1")).toBeVisible();

    await page.goBack();
    await expect(dialog).toHaveCount(0);
    await expect(page).not.toHaveURL(/id=/);
  });

  test("opens a linked object that is not in the list", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const events = makeEvents(2);
    await mockEvents(page, events);
    await frigateApp.goto(
      `/explore?labels=car&id=${encodeURIComponent(events[1]!.id)}`,
    );
    await expect(
      page.getByRole("dialog").getByText("Description 1"),
    ).toBeVisible();
  });

  test("saves an edited description", async ({ frigateApp }) => {
    const page = frigateApp.page;
    const events = makeEvents(1);
    await mockEvents(page, events);
    let body: unknown;
    await page.route("**/api/events/*/description", (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ json: { success: true } });
    });
    await frigateApp.goto("/explore?cameras=front_door");
    await page.locator(".explore-card__media").first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Edit", exact: true }).click();
    await dialog
      .getByRole("textbox", { name: "Description" })
      .fill("A courier");
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(dialog.getByText("A courier")).toBeVisible();
    expect(body).toEqual({ description: "A courier" });
  });

  test("lists the tracking timeline and adjusts the offset", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    await mockEvents(page, makeEvents(1));
    await frigateApp.goto("/explore?cameras=front_door");
    await page.locator(".explore-card__media").first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /tracking details/i }).click();
    await expect(dialog.getByText("Person detected")).toBeVisible();
    await expect(dialog.getByText("Person left")).toBeVisible();
    await dialog.getByText("Person left").click();

    await dialog
      .getByRole("button", { name: /adjust annotation settings/i })
      .click();
    await dialog.getByRole("button", { name: /increase annotation/i }).click();
    await expect(dialog.locator("output")).toHaveText("+50ms");
  });
});

test.describe("explore semantic search", () => {
  const ready = {
    "jinaai/jina-clip-v1-vision_model_quantized.onnx": "downloaded",
    "jinaai/jina-clip-v1-preprocessor_config.json": "downloaded",
    "jinaai/jina-clip-v1-text_model_fp16.onnx": "downloaded",
    "jinaai/jina-clip-v1-tokenizer": "downloaded",
  };

  test.beforeEach(async ({ frigateApp }) => {
    await frigateApp.installDefaults({
      config: { semantic_search: { enabled: true } },
    });
  });

  async function open(
    frigateApp: Parameters<Parameters<typeof test>[2]>[0]["frigateApp"],
    path: string,
    status = "completed",
  ) {
    await frigateApp.goto(path);
    await frigateApp.page.waitForTimeout(50);
    frigateApp.ws.send("model_state", JSON.stringify(ready));
    frigateApp.ws.send(
      "embeddings_reindex_progress",
      JSON.stringify({
        status,
        thumbnails: 5,
        descriptions: 2,
        processed_objects: 5,
        total_objects: 10,
        time_remaining: 60,
      }),
    );
  }

  test("is unavailable while embeddings reindex", async ({ frigateApp }) => {
    await mockEvents(frigateApp.page, makeEvents(1));
    await open(frigateApp, "/explore", "indexing");
    await expect(
      frigateApp.page.getByRole("heading", { name: "Explore is Unavailable" }),
    ).toBeVisible();
    await expect(frigateApp.page.getByRole("strong")).toHaveText("50%");
  });

  test("turns typed tags into filters and text into a search", async ({
    frigateApp,
  }) => {
    const page = frigateApp.page;
    const { requests } = await mockEvents(page, makeEvents(2));
    await open(frigateApp, "/explore");

    const search = page.getByRole("combobox", { name: "Search" });
    await search.pressSequentially("labels:person ");
    await expect(page).toHaveURL(/labels=person/);
    await expect(search).toHaveValue("");

    await search.fill("red jacket");
    await search.press("Enter");
    await expect(page).toHaveURL(/query=red(\+|%20)jacket/);
    await expect
      .poll(() => requests.at(-1)?.pathname)
      .toBe("/api/events/search");
    expect(requests.at(-1)!.searchParams.get("labels")).toBe("person");
    await expect(page.locator(".explore-card__match").first()).toBeVisible();
  });

  test("rejects a conflicting score", async ({ frigateApp }) => {
    const page = frigateApp.page;
    await mockEvents(page, makeEvents(1));
    await open(frigateApp, "/explore?max_score=0.7");
    const search = page.getByRole("combobox", { name: "Search" });
    await search.pressSequentially("min_score:80 ");
    await expect(page.getByText(/must be less than or equal/)).toBeVisible();
    await expect(page).not.toHaveURL(/min_score/);
  });

  test("finds similar objects from a card", async ({ frigateApp }) => {
    const page = frigateApp.page;
    const events = makeEvents(2);
    const { requests } = await mockEvents(page, events);
    await open(frigateApp, "/explore?cameras=front_door");

    await page
      .locator(".explore-card")
      .first()
      .getByRole("button", { name: "More" })
      .click();
    await page.getByRole("menuitem", { name: "Find similar" }).click();

    await expect(page.getByText("Similarity search active")).toBeVisible();
    await expect
      .poll(() => requests.at(-1)?.searchParams.get("search_type"))
      .toBe("similarity");
    expect(requests.at(-1)!.pathname).toBe("/api/events/search");
    expect(requests.at(-1)!.searchParams.get("event_id")).toBe(events[0]!.id);
  });
});
