import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("local save roundtrips to disk; invalid projects do not overwrite it", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "experiment-map-test-"));
  const file = path.join(directory, "project.json");
  const original = {
    schemaVersion: 1,
    title: "original",
    nodes: [],
    edges: [],
  };
  await writeFile(file, JSON.stringify(original));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const child = spawn(process.execPath, [path.join(root, "src/server.mjs")], {
    cwd: root,
    env: { ...process.env, PORT: "0", EXPERIMENT_MAP_DATA_FILE: file },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const exit = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exit;
    }
    for (const name of [
      "project.json",
      "project.backup.json",
      "project.json.tmp",
    ])
      await unlink(path.join(directory, name)).catch((error) => {
        if (error.code !== "ENOENT") throw error;
      });
    await rmdir(directory);
  });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Local server did not start")),
      8000,
    );
    child.stdout.on("data", (chunk) => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+\//);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    child.once("error", reject);
    child.stderr.on("data", (chunk) => reject(new Error(chunk.toString())));
  });
  const response = await fetch(url + "api/project");
  assert.equal(response.status, 200);
  assert.equal(
    (await (await fetch(url + "api/health")).json()).application,
    "experiment-map",
  );
  assert.deepEqual(await response.json(), original);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const changed = {
    ...original,
    title: "saved locally",
    nodes: [{ id: "a", title: "A", date: "2026-11-04" }],
  };
  const saved = await fetch(url + "api/project", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changed),
  });
  assert.equal(saved.status, 200);
  assert.equal(JSON.parse(await readFile(file, "utf8")).title, "saved locally");
  assert.equal(
    JSON.parse(
      await readFile(path.join(directory, "project.backup.json"), "utf8"),
    ).title,
    "original",
  );
  const invalid = await fetch(url + "api/project", {
    method: "PUT",
    body: JSON.stringify({ ...changed, edges: [{ from: "a", to: "a" }] }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(JSON.parse(await readFile(file, "utf8")).title, "saved locally");
  const foreign = await fetch(url + "api/project", {
    method: "PUT",
    headers: { Origin: "https://example.com" },
    body: JSON.stringify(original),
  });
  assert.equal(foreign.status, 403);
  const outside = await fetch(url + "server.mjs");
  assert.equal(outside.status, 404);
});
