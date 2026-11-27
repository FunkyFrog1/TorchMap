import assert from "node:assert/strict";
import test from "node:test";
import {
  MonitorHistory,
  monitorSnapshot,
} from "../src/server/monitor-sync.mjs";
import { mergeReply } from "../src/web/monitor-cache.js";

test("poll, multiple observers, changed and removed data, reorder, and expired baseline", () => {
  const history = new MonitorHistory();
  const a = { id: "a", step: 2 },
    b = { id: "b", step: 2 },
    c = { id: "c", step: 2 };
  const old = mergeReply(null, history.reply("view", { runs: [a, b] }, null));
  assert.deepEqual(history.reply("view", old.data, old.revision), {
    revision: old.revision,
  });
  const latest = { runs: [c, { ...a, step: 3 }] };
  const update = history.reply("view", latest, old.revision);
  assert.deepEqual(update.changes.runs.remove, ["b"]);
  assert.deepEqual(mergeReply(old, update).data, latest);
  assert.deepEqual(history.reply("view", latest, old.revision), update);
  assert.deepEqual(
    history.reply("other project", latest, old.revision).full,
    latest,
  );
  for (let i = 0; i < 5; i++)
    history.reply("view", { runs: [{ id: "n", step: i }] }, null);
  assert.deepEqual(history.reply("view", latest, old.revision).full, latest);
});
test("curve appends only new points and can replace the tail after a restart", () => {
  const h = new MonitorHistory();
  const initial = {
    points: [
      { id: 0, value: 1 },
      { id: 1, value: 2 },
      { id: 2, value: 3 },
    ],
  };
  const first = mergeReply(null, h.reply("series", initial, null));
  const extra = { id: 3, value: 4 };
  const append = h.reply(
    "series",
    { points: [...initial.points, extra] },
    first.revision,
  );
  assert.deepEqual(append.changes.points, { put: [extra], remove: [] });
  const latest = { points: [initial.points[0], { id: 1, value: 9 }] };
  const second = mergeReply(first, append);
  const correction = h.reply("series", latest, second.revision);
  assert.deepEqual(mergeReply(second, correction).data, latest);
});
test("scope retains parent checkpoint, curves, peers, configurations and roadmap cards", () => {
  const train = ["a", "b", "c"].map((id) => ({
    id,
    versionId: id,
    kind: "train",
    config: { id },
    checkpointId: id === "b" ? "ca" : null,
  }));
  const evals = train.map((r) => ({
    id: "e" + r.id,
    kind: "eval",
    checkpointId: "c" + r.id,
    finalMetrics: [{ name: "m", value: 42 }],
    summary: { extra: 1 },
  }));
  const snap = {
    runs: [...train, ...evals],
    checkpoints: train.map((r) => ({
      id: "c" + r.id,
      runId: r.id,
      step: 3,
      weights: "ema",
    })),
    artifacts: [],
  };
  const select = (view, ...ids) => monitorSnapshot(snap, view, new Set(ids));
  const testView = select("test", "b", "c");
  assert.deepEqual(
    testView.runs.map((r) => r.id),
    ["b", "c", "eb", "ec"],
  );
  assert.deepEqual(
    testView.checkpoints.map((c) => c.id),
    ["ca", "cb", "cc"],
  );
  assert.deepEqual(testView.runs[2].finalMetrics, evals[1].finalMetrics);
  assert.ok(!("summary" in testView.runs[2]));
  assert.ok(!("config" in testView.runs[0]));
  assert.deepEqual(select("config", "b").runs[0].config, { id: "b" });
  assert.deepEqual(
    select("roadmap").runs.map((r) => r.id),
    ["a", "b", "c"],
  );
});
