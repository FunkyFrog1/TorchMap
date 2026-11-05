import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DirectoryStore } from "../src/server/directory.mjs";

test("one dated version, two independent runs, rollback and late evaluation", async (t) => {
  const tmp = await mkdtemp(path.join(tmpdir(), "tm-directory-"));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const project = path.join(tmp, "renamable"),
    day = "2026-11-01",
    version = path.join(project, day, "001_test");
  async function put(dir, name, value) {
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, name),
      typeof value === "string" ? value : JSON.stringify(value),
    );
  }
  await put(project, "project.json", {
    protocol: "tensormap/directory-1",
    id: "lab",
    title: "Lab",
  });
  await put(version, "version.json", {
    id: "v",
    title: "Model",
    date: day,
    parents: [],
  });
  const a = path.join(version, "runs", "01"),
    b = path.join(version, "runs", "02");
  await put(a, "run.json", {
    id: "a",
    version_id: "v",
    attempt: 2,
    attempts: [{ number: 1 }, { number: 2, resume_step: 5 }],
    status: "running",
    checkpoints: [{ id: "a-5", step: 5, weights: "ema" }],
  });
  await put(b, "run.json", {
    id: "b",
    version_id: "v",
    status: "succeeded",
    checkpoints: [],
  });
  await put(
    a,
    "metrics.jsonl",
    '{"attempt":1,"step":5,"metrics":{"loss":2}}\n{"attempt":1,"step":8,"metrics":{"loss":8}}\n{"attempt":2,"step":6,"metrics":{"loss":1}}\n{"partial":',
  );
  const ed = path.join(a, "evals", "later");
  await put(ed, "eval.json", {
    id: "later",
    checkpoint_id: "a-5",
    dataset: "test",
    protocol: "v1",
    status: "succeeded",
    progress: { done: 7, total: 7 },
  });
  await put(ed, "summary.json", { metrics: { accuracy: 0.8 } });
  const store = new DirectoryStore(tmp);
  assert.equal((await store.list())[0].id, "lab");
  const db = await store.ledger("lab"),
    s = db.snapshot();
  assert.equal(db.map.nodes.length, 1);
  assert.equal(s.runs.filter((r) => r.kind === "train").length, 2);
  assert.deepEqual(
    db.series.get("a").map((r) => r.step),
    [5, 6],
  );
  assert.equal(s.runs.find((r) => r.kind === "eval").checkpointId, "a-5");
  assert.equal(
    s.runs.find((r) => r.kind === "eval").finalMetrics[0].value,
    0.8,
  );
});
