import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

async function chooseLanguage(page, value) {
  if ((await page.locator("html").getAttribute("lang")) !== value)
    await page.locator("#language").click();
}
async function chooseTheme(page, value) {
  for (let i = 0; i < 5; i++) {
    if ((await page.locator("html").getAttribute("data-theme")) === value)
      return;
    await page.locator("#theme").click();
  }
  expect(await page.locator("html").getAttribute("data-theme")).toBe(value);
}
async function openMenu(page, id) {
  const menu = page.locator("#" + id);
  if (!((await menu.getAttribute("open")) !== null))
    await menu.locator("summary").click();
}
let server, url, directory;
const fixture = JSON.parse(
  await readFile(new URL("../examples/demo.en.json", import.meta.url), "utf8"),
);

test.beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "experiment-map-browser-"));
  const environment = {
    ...process.env,
    PORT: "0",
    EXPERIMENT_MAP_DATA_FILE: path.join(directory, "project.json"),
  };
  delete environment.FORCE_COLOR;
  server = spawn(process.execPath, ["src/server.mjs"], {
    env: environment,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  url = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Server startup timed out")),
      10000,
    );
    server.stdout.on("data", (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
    server.once("error", reject);
    server.stderr.on("data", (chunk) => reject(new Error(chunk.toString())));
  });
});
test.afterAll(async () => {
  if (server?.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  // This directory is created by this test alone and contains no user files.
  if (directory) await rm(directory, { recursive: true, force: true });
});
test.beforeEach(async ({ page, request }) => {
  page.errors = [];
  page.on("pageerror", (error) => page.errors.push(error.message));
  const response = await request.put(url + "api/project", { data: fixture });
  expect(response.ok()).toBeTruthy();
  await page.goto(url);
  await expect(page.locator(".experiment-node")).toHaveCount(8);

  await chooseLanguage(page, "en");
});
test.afterEach(async ({ page }) => expect(page.errors).toEqual([]));

test("blank canvas restores all card and wire colors and clears the URL selection", async ({
  page,
}) => {
  await page.locator('.experiment-node[data-id="v3"]').click();
  await expect(page.locator(".experiment-node.is-muted")).toHaveCount(5);
  await page.locator("#viewport").click({ position: { x: 15, y: 15 } });
  await expect(
    page.locator(".experiment-node.is-muted,.wire.is-muted"),
  ).toHaveCount(0);
  await expect(
    page.locator(".experiment-node.is-selected,.experiment-node.is-upstream"),
  ).toHaveCount(0);
  await expect(page).toHaveURL(url);
  await expect(page.locator("#focus")).toBeDisabled();
  if (process.env.UPDATE_SCREENSHOT) {
    await mkdir("docs/assets", { recursive: true });

    await page.screenshot({
      path: "docs/assets/screenshot.png",
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("pan and canceled gestures preserve selection", async ({ page }) => {
  await page.locator('.experiment-node[data-id="v3"]').click();
  const box = await page.locator("#viewport").boundingBox();
  await page.mouse.move(box.x + 15, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + 75, box.y + 40, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator(".is-selected")).toHaveAttribute("data-id", "v3");
  await expect(page.locator(".is-selected")).toHaveAttribute("data-id", "v3");
  await page.mouse.move(box.x + 15, box.y + 15);
  await page.mouse.down();
  await page
    .locator("#viewport")
    .dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(page.locator(".is-selected")).toHaveAttribute("data-id", "v3");
  expect(await page.evaluate(() => getSelection().toString())).toBe("");
});

test("language preference persists and does not translate or mutate project content", async ({
  page,
  request,
}) => {
  const before = await (await request.get(url + "api/project")).json();
  await expect(page.locator("#add-node")).toHaveText("＋ Add model version");

  await chooseLanguage(page, "zh-CN");
  await expect(page.locator("#add-node")).toHaveText("＋ 新增模型版本");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator("#project-picker option:checked")).toHaveText(
    fixture.title,
  );
  expect(await (await request.get(url + "api/project")).json()).toEqual(before);
});

test("editing supports multiple upstream links, save/reload and undo/redo", async ({
  page,
}) => {
  await page.locator("#add-node").click();
  await page.locator('#node-form [name="title"]').fill("New version");
  await page.locator('#node-form [name="date"]').fill("2026-01-14");
  await page.locator('#parent-options input[value="v3"]').check();
  await page.locator('#parent-options input[value="v4"]').check();
  await page.locator('#node-form button[type="submit"]').click();
  await expect(page.locator(".experiment-node")).toHaveCount(9);
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  await page.locator("#undo").click();
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  await page.locator("#redo").click();
  await expect(page.locator(".experiment-node")).toHaveCount(9);
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(9);
  await expect(page.locator("#inspector .parent-link")).toHaveCount(2);
});

test("moving a card to another date preserves its lane and new successors align with it", async ({
  page,
  request,
}) => {
  const card = page.locator('.experiment-node[data-id="v4"]');
  const initialTop = await card.evaluate((node) => node.style.top);
  await card.click();
  await page.locator("#inspector .primary").click();
  await page.locator('#node-form [name="date"]').fill("2026-01-15");
  await page.locator('#node-form button[type="submit"]').click();
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  expect(await card.evaluate((node) => node.style.top)).toBe(initialTop);
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  expect(await card.evaluate((node) => node.style.top)).toBe(initialTop);
  await page.locator("#add-node").click();
  await page.locator('#node-form [name="title"]').fill("Continuation");
  await page.locator('#node-form [name="date"]').fill("2026-01-16");
  await page.locator('#parent-options input[value="v4"]').check();
  await page.locator('#node-form button[type="submit"]').click();
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  const added = page
    .locator(".experiment-node")
    .filter({ hasText: "Continuation" });
  expect(await added.evaluate((node) => node.style.top)).toBe(initialTop);
  const saved = await (await request.get(url + "api/project")).json();
  expect(saved.nodes.find((node) => node.title === "Continuation").row).toBe(2);
  if (process.env.LAYOUT_SCREENSHOT) {
    await page.screenshot({
      path: process.env.LAYOUT_SCREENSHOT,
      fullPage: true,
      animations: "disabled",
    });
  }
});

test("moving into an occupied lane does not displace cards already on that date", async ({
  page,
}) => {
  const existing = page.locator('.experiment-node[data-id="v8"]');
  const before = await existing.evaluate((node) => node.style.top);
  await page.locator('.experiment-node[data-id="v4"]').click();
  await page.locator("#inspector .primary").click();
  await page.locator('#node-form [name="date"]').fill("2026-01-12");
  await page.locator('#node-form button[type="submit"]').click();
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  expect(await existing.evaluate((node) => node.style.top)).toBe(before);
  expect(
    await page
      .locator('.experiment-node[data-id="v4"]')
      .evaluate((node) => node.style.top),
  ).not.toBe(before);
});

test("import/export roundtrip and invalid import leaves the current graph intact", async ({
  page,
}) => {
  const downloading = page.waitForEvent("download");
  await openMenu(page, "project-menu");
  await page.locator("#export-project").click();
  const download = await downloading;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(exported.nodes).toHaveLength(8);
  await page.locator("#import-file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.locator("#toast")).toContainText("Import failed");
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  await page.locator("#import-file").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.locator("#toast")).toContainText("Imported 8 versions");
});

test("invalid browser draft cannot prevent loading; user markup stays plain text", async ({
  page,
  request,
}) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "experiment-map:v1:draft:" + location.host,
      "not-json",
    ),
  );
  const custom = structuredClone(fixture);
  custom.nodes[0].title = '<img src=x onerror="window.injected=1">';
  await request.put(url + "api/project", { data: custom });
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  await expect(page.locator(".experiment-node img")).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test("phone layout has no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#viewport")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("vertical dragging swaps occupied rows and survives reload without changing dates", async ({
  page,
  request,
}) => {
  const a = page.locator('.experiment-node[data-id="v3"]');
  const b = page.locator('.experiment-node[data-id="v4"]');
  const topA = await a.evaluate((n) => n.style.top),
    topB = await b.evaluate((n) => n.style.top);
  const box = await a.boundingBox();
  const scale = box.width / 250;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 30,
    box.y + box.height / 2 + 408 * scale,
    { steps: 15 },
  );
  await page.mouse.up();
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  expect(await a.evaluate((n) => n.style.top)).toBe(topB);
  expect(await b.evaluate((n) => n.style.top)).toBe(topA);
  await page.locator("#undo").click();
  expect(await a.evaluate((n) => n.style.top)).toBe(topA);
  await page.locator("#redo").click();
  expect(await a.evaluate((n) => n.style.top)).toBe(topB);
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  expect(await a.evaluate((n) => n.style.left)).toBe(
    await b.evaluate((n) => n.style.left),
  );
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  expect(await a.evaluate((n) => n.style.top)).toBe(topB);
  const saved = await (await request.get(url + "api/project")).json();
  expect(saved.nodes.find((n) => n.id === "v3").date).toBe("2026-01-08");
});

async function dragFirstBranch(page) {
  const card = page.locator('.experiment-node[data-id="v3"]');
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + box.height / 2 + (408 * box.width) / 250,
    { steps: 12 },
  );
  await page.mouse.up();
}

test("switch waits for the last drag save and freezes further edits while waiting", async ({
  page,
  request,
}) => {
  const created = await (
    await request.post(url + "api/projects", {
      data: {
        schemaVersion: 1,
        title: "Slow switch target",
        nodes: [],
        edges: [],
      },
    })
  ).json();
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let first = true;
  await page.route("**/api/project", async (route) => {
    if (route.request().method() === "PUT" && first) {
      first = false;
      await gate;
    }
    await route.continue();
  });
  await dragFirstBranch(page);
  await page.locator("#project-picker").selectOption(created.id);
  await expect(page.locator(".workspace")).toHaveAttribute("inert", "");
  await page.keyboard.press("Control+z");
  release();
  await expect(page).toHaveURL(url + "?project=" + created.id);
  await expect(page.locator(".experiment-node")).toHaveCount(0);
  const original = await (await request.get(url + "api/project")).json();
  expect(original.nodes.find((n) => n.id === "v3").row).toBe(2);
});

test("failed save blocks switching and recovers the correct project draft on reload", async ({
  page,
  request,
}) => {
  const created = await (
    await request.post(url + "api/projects", {
      data: {
        schemaVersion: 1,
        title: "Untouched target",
        nodes: [],
        edges: [],
      },
    })
  ).json();
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  await page.route("**/api/project", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 500, json: { error: "Test write failure" } })
      : route.continue(),
  );
  await dragFirstBranch(page);
  await expect(page.locator("#save-state")).toContainText("Not saved");
  await page.locator("#project-picker").selectOption(created.id);
  await expect(page.locator("#project-picker")).toHaveValue("default");
  await expect(page.locator(".workspace")).not.toHaveAttribute("inert", "");
  expect(page.url()).not.toContain("?project=");
  await page.unroute("**/api/project");
  await page.reload();
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  expect(
    (await (await request.get(url + "api/project")).json()).nodes.find(
      (n) => n.id === "v3",
    ).row,
  ).toBe(2);
  expect(
    (
      await (
        await request.get(url + "api/project?project=" + created.id)
      ).json()
    ).nodes,
  ).toHaveLength(0);
});

test("project list network failure does not prevent saving the current card layout", async ({
  page,
  request,
}) => {
  await page.route("**/api/projects", (route) => route.abort());
  await dragFirstBranch(page);
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  expect(
    (await (await request.get(url + "api/project")).json()).nodes.find(
      (n) => n.id === "v3",
    ).row,
  ).toBe(2);
});

test("a stalled project-list refresh does not hold up a completed save or switch", async ({
  page,
  request,
}) => {
  const { id } = await (
    await request.post(url + "api/projects", {
      data: {
        schemaVersion: 1,
        title: "Available target",
        nodes: [],
        edges: [],
      },
    })
  ).json();
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/api/projects", async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  await dragFirstBranch(page);
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  await page.locator("#project-picker").selectOption(id);
  await expect(page).toHaveURL(url + "?project=" + id);
  release();
  await expect(page.locator("#project-picker option:checked")).toHaveText(
    "Available target",
  );
});

test("an archived project cannot be recreated by an old tab save", async ({
  request,
}) => {
  const data = {
    schemaVersion: 1,
    title: "Archive test",
    nodes: [],
    edges: [],
  };
  const { id } = await (
    await request.post(url + "api/projects", { data })
  ).json();
  await request.put(url + "api/project?project=" + id, { data });
  expect(
    (await request.delete(url + "api/projects?project=" + id)).ok(),
  ).toBeTruthy();
  expect(
    (await request.put(url + "api/project?project=" + id, { data })).status(),
  ).toBe(404);
  expect(
    (await (await request.get(url + "api/projects")).json()).some(
      (p) => p.id === id,
    ),
  ).toBeFalsy();
});

test("projects remain independent across create, switch, rename and archive", async ({
  page,
  request,
}) => {
  await openMenu(page, "project-menu");
  await page.locator("#new-project").click();
  await page.locator('#project-form [name="title"]').fill("Second project");
  await page.locator('#project-form button[type="submit"]').click();
  await expect(page).toHaveURL(/\?project=/);
  await expect(page.locator("#project-picker option:checked")).toHaveText(
    "Second project",
  );
  await expect(page.locator(".experiment-node")).toHaveCount(0);
  const id = new URL(page.url()).searchParams.get("project");
  await openMenu(page, "project-menu");
  await page.locator("#project-settings").click();
  await page.locator('#project-form [name="title"]').fill("Renamed project");
  await page.locator('#project-form button[type="submit"]').click();
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  await expect(page.locator("#project-picker option:checked")).toHaveText(
    "Renamed project",
  );
  await page.locator("#project-picker").selectOption("default");
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  await expect(page.locator("#undo")).toBeDisabled();
  await page.locator("#project-picker").selectOption(id);
  await expect(page.locator("#project-picker option:checked")).toHaveText(
    "Renamed project",
  );
  await openMenu(page, "project-menu");
  await page.locator("#archive-project").click();
  await page.locator("#confirm-action").click();
  await expect(page).toHaveURL(url);
  await expect(page.locator(".experiment-node")).toHaveCount(8);
  const listed = await (await request.get(url + "api/projects")).json();
  expect(listed.some((p) => p.id === id)).toBeFalsy();
  expect(
    (
      await request.post(url + "api/projects", {
        headers: { Origin: "https://example.com" },
        data: fixture,
      })
    ).status(),
  ).toBe(403);
});

test("detailed fictional demo keeps its main line aligned across six date columns", async ({
  page,
  request,
}) => {
  const demo = JSON.parse(
    await readFile(
      new URL("../examples/branching.zh-CN.json", import.meta.url),
      "utf8",
    ),
  );
  await request.put(url + "api/project", { data: demo });
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(12);

  await chooseLanguage(page, "zh-CN");
  await expect(page.locator(".date-column")).toHaveCount(6);
  const tops = await page
    .locator(
      '[data-id="start"],[data-id="base"],[data-id="layout"],[data-id="refine"],[data-id="merge"],[data-id="release"]',
    )
    .evaluateAll((nodes) => nodes.map((node) => node.style.top));
  expect(new Set(tops).size).toBe(1);
  await page.locator('[data-id="merge"]').click();
  await expect(page.locator("#inspector .parent-link")).toHaveCount(3);
  if (process.env.UPDATE_SCREENSHOT)
    await page.screenshot({
      path: "docs/assets/screenshot.png",
      fullPage: true,
      animations: "disabled",
    });
});

test("wires avoid actual card bounds and only fine-tuning is dashed", async ({
  page,
  request,
}) => {
  const nodes = [
    ["a", "2026-01-01", 1],
    ["upper", "2026-01-01", 0],
    ["same-block", "2026-01-01", 2],
    ["same-end", "2026-01-01", 3],
    ["block", "2026-01-02", 1],
    ["lower", "2026-01-02", 4],
    ["b", "2026-01-03", 1],
    ["top", "2026-01-03", 0],
    ["bottom", "2026-01-03", 4],
  ].map(([id, date, row]) => ({ id, title: id, date, row }));
  const edges = [
    { from: "a", to: "b", kind: "branch" },
    { from: "upper", to: "top", kind: "finetune" },
    { from: "a", to: "same-end", kind: "branch" },
    { from: "b", to: "same-end", kind: "merge" },
    { from: "a", to: "bottom", kind: "merge" },
  ];
  await request.put(url + "api/project", {
    data: { schemaVersion: 1, title: "Wire routing fixture", nodes, edges },
  });
  await page.reload();
  await expect(page.locator(".wire")).toHaveCount(edges.length);
  const intersections = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".experiment-node")].map(
      (n) => ({
        id: n.dataset.id,
        x: parseFloat(n.style.left),
        y: parseFloat(n.style.top),
        w: 250,
        h: 162,
      }),
    );
    const hits = [];
    for (const path of document.querySelectorAll(".wire")) {
      const length = path.getTotalLength();
      for (let t = 0; t <= length; t += 2) {
        const p = path.getPointAtLength(t);
        const hit = cards.find(
          (n) =>
            n.id !== path.dataset.from &&
            n.id !== path.dataset.to &&
            p.x > n.x - 5 &&
            p.x < n.x + n.w + 5 &&
            p.y > n.y - 5 &&
            p.y < n.y + n.h + 5,
        );
        if (hit) {
          hits.push({
            from: path.dataset.from,
            to: path.dataset.to,
            hit: hit.id,
          });
          break;
        }
      }
    }
    return hits;
  });
  expect(intersections).toEqual([]);
  const direct = page.locator('.wire[data-from="upper"][data-to="top"]');
  await expect(direct).toHaveAttribute("d", "M290,162 L720,162");
  expect(
    await direct.evaluate((node) => getComputedStyle(node).strokeDasharray),
  ).not.toBe("none");
  for (const wire of await page.locator(".wire.merge,.wire.branch").all())
    expect(
      await wire.evaluate((node) => getComputedStyle(node).strokeDasharray),
    ).toBe("none");
  expect(await page.locator(".map-legend").textContent()).not.toContain(
    "方案参考",
  );
});

test("wires follow a card during drag and return when the gesture is canceled", async ({
  page,
}) => {
  const card = page.locator('[data-id="v3"]');
  const wire = page.locator('.wire[data-to="v3"]');
  const before = await wire.getAttribute("d");
  const index = await wire.evaluate((node) =>
    [...document.querySelectorAll(".wire")].indexOf(node),
  );
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + box.height / 2 + (204 * box.width) / 250,
    { steps: 10 },
  );
  await expect(wire).not.toHaveAttribute("d", before);

  await card.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(wire).toHaveAttribute("d", before);
});

test("five retro themes persist without changing model records, layout or selection", async ({
  page,
  request,
}) => {
  const before = await (await request.get(url + "api/project")).json();
  await page.locator('[data-id="v3"]').click();
  const position = await page
    .locator('[data-id="v3"]')
    .evaluate((n) => [n.style.left, n.style.top]);
  const camera = await page.locator("#world").getAttribute("style");
  await expect(page.locator("#theme")).toHaveRole("button");
  const backgrounds = new Set(),
    cardColors = new Set();
  for (const theme of ["lagoon", "dune", "coral", "oasis", "dusk"]) {
    await chooseTheme(page, theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const colors = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      function rgb(hex) {
        return hex
          .trim()
          .slice(1)
          .match(/../g)
          .map((v) => parseInt(v, 16) / 255);
      }
      function luminance(c) {
        return rgb(c)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      }
      function contrast(a, b) {
        const x = luminance(a),
          y = luminance(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
      }
      return {
        page: root.backgroundColor,
        card: getComputedStyle(
          document.querySelector('[data-id="v3"] .node-header'),
        ).backgroundColor,
        textContrast: contrast(
          root.getPropertyValue("--text"),
          root.getPropertyValue("--panel"),
        ),
        buttonContrast: contrast(root.getPropertyValue("--action"), "#ffffff"),
      };
    });
    backgrounds.add(colors.page);
    cardColors.add(colors.card);
    expect(colors.textContrast).toBeGreaterThanOrEqual(4.5);
    expect(colors.buttonContrast).toBeGreaterThanOrEqual(4.5);
    expect(
      await page
        .locator('[data-id="v3"]')
        .evaluate((n) => [n.style.left, n.style.top]),
    ).toEqual(position);
    await expect(page.locator('[data-id="v3"]')).toHaveClass(/is-selected/);
    expect(await page.locator("#world").getAttribute("style")).toBe(camera);
  }
  expect(backgrounds.size).toBe(1);
  expect(cardColors.size).toBe(5);
  expect(await (await request.get(url + "api/project")).json()).toEqual(before);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dusk");

  await chooseLanguage(page, "zh-CN");
  await expect(page.locator("#theme")).toHaveAttribute(
    "aria-label",
    "暮色电台",
  );
});

test("model editor keeps initialization and excludes descendant upstream models", async ({
  page,
  request,
}) => {
  await page.locator('[data-id="v2"]').click();
  await page.locator("#inspector .primary").click();
  await expect(page.locator("#parent-options input")).toHaveCount(1);
  await expect(page.locator("#parent-options input")).toHaveValue("v1");
  await page
    .locator('#node-form [name="initialization"]')
    .fill("Scratch training, seed 43; no old checkpoint loaded.");
  await page.locator('#node-form button[type="submit"]').click();
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  await page.reload();
  await expect(page.locator("#inspector")).toContainText(
    "Scratch training, seed 43",
  );
  expect(
    (await (await request.get(url + "api/project")).json()).nodes.find(
      (n) => n.id === "v2",
    ).initialization,
  ).toContain("seed 43");
});

test("model themes preview and mobile toolbar stay usable", async ({
  page,
  request,
}) => {
  const demo = JSON.parse(
    await readFile(
      new URL("../examples/branching.zh-CN.json", import.meta.url),
      "utf8",
    ),
  );
  await request.put(url + "api/project", { data: demo });
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(12);

  await chooseLanguage(page, "zh-CN");
  if (process.env.UPDATE_SCREENSHOT)
    await page.screenshot({
      path: "docs/assets/default-card-colors.png",
      animations: "disabled",
    });
  await page.locator('[data-id="merge"]').click();
  if (process.env.UPDATE_SCREENSHOT) {
    for (const theme of ["lagoon", "dune", "coral", "oasis", "dusk"]) {
      await chooseTheme(page, theme);

      await page.screenshot({
        path: "docs/assets/theme-" + theme + ".png",
        fullPage: true,
        animations: "disabled",
      });
    }

    await chooseTheme(page, "lagoon");

    await page.screenshot({
      path: "docs/assets/screenshot.png",
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const toolbar = await page.locator(".map-toolbar").boundingBox();
  const zoom = await page.locator("#zoom-in").boundingBox();
  expect(zoom.y + zoom.height).toBeLessThanOrEqual(
    toolbar.y + toolbar.height + 1,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();

  await chooseTheme(page, "coral");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "coral");
});

test("compact menus, collapsed details and view preferences remain independent of model records", async ({
  page,
  request,
}) => {
  const before = await (await request.get(url + "api/project")).json();
  await expect(page.locator("#project-title")).toHaveCount(0);
  await expect(page.locator(".node-date,.node-summary")).toHaveCount(0);
  await expect(page.locator("#save-state")).toBeHidden();
  await page.locator('[data-id="v3"]').click();
  for (const detail of await page.locator("#inspector details").all())
    await expect(detail).not.toHaveAttribute("open", "");

  await expect(
    page.locator(
      "#minimap,#intro-tip,#show-minimap,#show-help,#appearance-menu",
    ),
  ).toHaveCount(0);
  await expect(page.locator("#fit svg")).toHaveCount(1);
  await expect(page.locator("#focus svg")).toHaveCount(1);
  await expect(page.locator("#fit")).toHaveAttribute("title", "Fit all");
  await expect(page.locator("#focus")).toHaveAttribute(
    "title",
    "Focus selection",
  );
  expect(await (await request.get(url + "api/project")).json()).toEqual(before);
});

test("dragging a hover handle creates a model at the target date and preserves saved lanes", async ({
  page,
  request,
}) => {
  const source = page.locator('[data-id="v1"]');
  await expect(page.locator(".app-header #add-node")).toHaveCount(0);
  await expect(page.locator(".map-toolbar #add-node")).toHaveCount(1);
  await source.dblclick();
  const card = await source.boundingBox();
  const handle = page.locator('.branch-handle[data-parent="v1"]');
  await source.hover();
  await expect(handle).toHaveCSS("opacity", "1");
  const h = await handle.boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    card.x + card.width / 2 + 340,
    card.y + card.height / 2 + 100,
    { steps: 12 },
  );
  await expect(page.locator(".branch-date")).toHaveText("2026-01-07");
  if (process.env.UPDATE_SCREENSHOT)
    await page.screenshot({
      path: "docs/assets/drag-create.png",
      animations: "disabled",
    });
  await page.mouse.up();
  await expect(page.locator("#node-dialog")).toBeVisible();
  await expect(page.locator('#node-form [name="date"]')).toHaveValue(
    "2026-01-07",
  );
  await expect(page.locator('#parent-options input[value="v1"]')).toBeChecked();
  await page.locator('#node-form [name="title"]').fill("Dragged model");
  await page.locator('#node-form button[type="submit"]').click();
  await expect(page.locator(".experiment-node")).toHaveCount(9);
  await expect(page.locator("#save-state")).toHaveText("Saved locally");
  const saved = await (await request.get(url + "api/project")).json();
  const created = saved.nodes.find((n) => n.title === "Dragged model");
  expect(created.date).toBe("2026-01-07");
  expect(created.row).toBe(2);
  expect(saved.edges).toContainEqual({
    from: "v1",
    to: created.id,
    kind: "branch",
    label: "",
  });
  for (const node of fixture.nodes)
    expect(saved.nodes.find((n) => n.id === node.id).row).toBe(node.row);
  await page.reload();
  await expect(page.locator(".experiment-node")).toHaveCount(9);
});

test("canceling a connector drag or its editor leaves no model or link behind", async ({
  page,
  request,
}) => {
  const before = await (await request.get(url + "api/project")).json();
  const source = page.locator('[data-id="v1"]');
  await source.dblclick();
  const card = await source.boundingBox();
  const handle = page.locator('.branch-handle[data-parent="v1"]');
  for (const mode of ["escape", "pointercancel", "editor"]) {
    await source.hover();
    const h = await handle.boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      card.x + card.width / 2 + 340,
      card.y + card.height / 2 + 100,
      { steps: 6 },
    );
    if (mode === "escape") await page.keyboard.press("Escape");
    if (mode === "pointercancel")
      await handle.dispatchEvent("pointercancel", { pointerId: 1 });
    await page.mouse.up();
    if (mode === "editor") {
      await expect(page.locator("#node-dialog")).toBeVisible();
      await page.locator("#node-dialog .dialog-header .close-dialog").click();
    }
    await expect(page.locator("#node-dialog")).not.toBeVisible();
    await expect(page.locator(".branch-preview,.branch-date")).toHaveCount(0);
  }
  expect(await (await request.get(url + "api/project")).json()).toEqual(before);
});

test("dragging beyond the final date column preselects a new calendar date", async ({
  page,
}) => {
  const last = [...fixture.nodes]
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  const source = page.locator('[data-id="' + last.id + '"]');
  await source.dblclick();
  const card = await source.boundingBox();
  await source.hover();
  const handle = page.locator('.branch-handle[data-parent="' + last.id + '"]');
  const h = await handle.boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    card.x + card.width / 2 + 340,
    card.y + card.height / 2 + 40,
    { steps: 8 },
  );
  await page.mouse.up();
  const date = new Date(last.date + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  await expect(page.locator('#node-form [name="date"]')).toHaveValue(
    date.toISOString().slice(0, 10),
  );
  await expect(
    page.locator('#parent-options input[value="' + last.id + '"]'),
  ).toBeChecked();
});

async function cameraPosition(page) {
  return page.locator("#world").evaluate((node) =>
    node.style.transform
      .match(/translate\(([-\d.]+)px,\s*([-\d.]+)px/)
      .slice(1)
      .map(Number),
  );
}
async function beginConnector(page) {
  const card = page.locator('[data-id="v1"]');
  await card.hover();
  const h = await page
    .locator('.branch-handle[data-parent="v1"]')
    .boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
}

test("connector edge pan continues with a stationary pointer and drops at the updated date", async ({
  page,
}) => {
  await page.locator('[data-id="v1"]').dblclick();
  const rect = await page.locator("#viewport").boundingBox();
  const before = await cameraPosition(page);
  await beginConnector(page);
  await page.mouse.move(rect.x + rect.width - 4, rect.y + rect.height / 2, {
    steps: 8,
  });
  const firstDate = await page.locator(".branch-date").textContent();
  await expect
    .poll(async () => (await cameraPosition(page))[0])
    .toBeLessThan(before[0] - 100);
  await expect(page.locator(".branch-date")).not.toHaveText(firstDate);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2, {
    steps: 4,
  });
  const stopped = await cameraPosition(page);
  await page.waitForTimeout(160);
  expect(await cameraPosition(page)).toEqual(stopped);
  const date = await page.locator(".branch-date").textContent();
  await page.mouse.up();
  await expect(page.locator('#node-form [name="date"]')).toHaveValue(date);
  await expect(page.locator('#parent-options input[value="v1"]')).toBeChecked();
  const after = await cameraPosition(page);
  await page.waitForTimeout(160);
  expect(await cameraPosition(page)).toEqual(after);
  await expect(page.locator(".branch-date,.branch-preview")).toHaveCount(0);
});

test("left top bottom edge pan stops after Escape and white cards keep colored headers", async ({
  page,
  request,
}) => {
  const beforeProject = await (await request.get(url + "api/project")).json();
  await page.locator('[data-id="v1"]').dblclick();
  const rect = await page.locator("#viewport").boundingBox();
  for (const [x, y, axis, sign] of [
    [4, rect.height / 2, 0, 1],
    [rect.width / 2, 4, 1, 1],
    [rect.width / 2, rect.height - 4, 1, -1],
  ]) {
    await page.locator("#focus").click();
    const before = await cameraPosition(page);
    await beginConnector(page);
    await page.mouse.move(rect.x + x, rect.y + y, { steps: 8 });
    await expect
      .poll(
        async () => ((await cameraPosition(page))[axis] - before[axis]) * sign,
      )
      .toBeGreaterThan(45);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator(".branch-date,.branch-preview")).toHaveCount(0);
    const stopped = await cameraPosition(page);
    await page.waitForTimeout(120);
    expect(await cameraPosition(page)).toEqual(stopped);
    await expect(page.locator("#node-dialog")).not.toBeVisible();
  }
  expect(await (await request.get(url + "api/project")).json()).toEqual(
    beforeProject,
  );
  for (const theme of ["lagoon", "dune", "coral", "oasis", "dusk"]) {
    await chooseTheme(page, theme);
    await expect(page.locator('[data-id="v1"]')).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    const header = await page
      .locator('[data-id="v1"] .node-header')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(header).not.toBe("rgb(255, 255, 255)");
  }
});

test("project switch cancels edge pan while saving and a failed save retains the source project", async ({
  page,
  request,
}) => {
  const created = await (
    await request.post(url + "api/projects", {
      data: {
        schemaVersion: 1,
        title: "Isolated target",
        nodes: [],
        edges: [],
      },
    })
  ).json();
  await page.reload();
  await chooseLanguage(page, "en");
  await expect(
    page.locator('#project-picker option[value="' + created.id + '"]'),
  ).toHaveCount(1);
  const before = await (await request.get(url + "api/project")).json();
  await page.locator('[data-id="v1"]').dblclick();
  const rect = await page.locator("#viewport").boundingBox();
  const start = await cameraPosition(page);
  await beginConnector(page);
  await page.mouse.move(rect.x + rect.width - 4, rect.y + rect.height / 2, {
    steps: 6,
  });
  await expect
    .poll(async () => (await cameraPosition(page))[0])
    .toBeLessThan(start[0] - 30);
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/api/project", async (route) => {
    if (route.request().method() === "PUT") {
      await gate;
      await route.fulfill({
        status: 500,
        json: { error: "Test write failure" },
      });
    } else await route.continue();
  });
  await page.locator("#project-picker").selectOption(created.id);
  await expect(page.locator(".project-sidebar")).toHaveAttribute("inert", "");
  await expect(page.locator(".branch-preview,.branch-date")).toHaveCount(0);
  const stopped = await cameraPosition(page);
  await page.waitForTimeout(140);
  expect(await cameraPosition(page)).toEqual(stopped);
  release();
  await page.mouse.up();
  await expect(page.locator("#project-picker")).toHaveValue("default");
  await expect(page.locator(".project-sidebar")).not.toHaveAttribute(
    "inert",
    "",
  );
  await expect(page.locator("#node-dialog")).not.toBeVisible();
  expect(await (await request.get(url + "api/project")).json()).toEqual(before);
  expect(
    (
      await (
        await request.get(url + "api/project?project=" + created.id)
      ).json()
    ).nodes,
  ).toHaveLength(0);
});

test("blur and a canvas rebuild stop an active connector without retaining animation callbacks", async ({
  page,
  request,
}) => {
  const before = await (await request.get(url + "api/project")).json();
  for (const mode of ["blur", "language"]) {
    await page.locator('[data-id="v1"]').dblclick();
    const rect = await page.locator("#viewport").boundingBox();
    const start = await cameraPosition(page);
    await beginConnector(page);
    await page.mouse.move(rect.x + rect.width - 4, rect.y + rect.height / 2, {
      steps: 6,
    });
    await expect
      .poll(async () => (await cameraPosition(page))[0])
      .toBeLessThan(start[0] - 30);
    if (mode === "blur")
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else await page.locator("#language").dispatchEvent("click");
    await expect(page.locator(".branch-preview,.branch-date")).toHaveCount(0);
    await page.mouse.up();
    const stopped = await cameraPosition(page);
    await page.waitForTimeout(140);
    expect(await cameraPosition(page)).toEqual(stopped);
    await expect(page.locator("#node-dialog")).not.toBeVisible();
  }
  expect(await (await request.get(url + "api/project")).json()).toEqual(before);
});

test("connector date follows zoom and pan; releasing outside the canvas creates nothing", async ({
  page,
  request,
}) => {
  const before = await (await request.get(url + "api/project")).json();
  const viewport = await page.locator("#viewport").boundingBox();
  await page.mouse.move(viewport.x + 15, viewport.y + 15);
  await page.mouse.down();
  await page.mouse.move(viewport.x + 55, viewport.y + 45, { steps: 5 });
  await page.mouse.up();
  await beginConnector(page);
  const target = await page.locator('[data-id="v2"]').boundingBox();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 8 },
  );
  await expect(page.locator(".branch-date")).toHaveText("2026-01-07");
  await page.mouse.wheel(0, -100);
  const zoomTarget = await page.locator('[data-id="v2"]').boundingBox();
  await page.mouse.move(
    zoomTarget.x + zoomTarget.width / 2,
    zoomTarget.y + zoomTarget.height / 2,
    { steps: 4 },
  );
  await expect(page.locator(".branch-date")).toHaveText("2026-01-07");
  await page.mouse.up();
  await expect(page.locator('#node-form [name="date"]')).toHaveValue(
    "2026-01-07",
  );
  await page.locator("#node-dialog .dialog-header .close-dialog").click();
  await beginConnector(page);
  await page.mouse.move(
    viewport.x + viewport.width + 35,
    viewport.y + viewport.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.locator("#node-dialog")).not.toBeVisible();
  await expect(page.locator(".branch-preview,.branch-date")).toHaveCount(0);
  expect(await (await request.get(url + "api/project")).json()).toEqual(before);
});
