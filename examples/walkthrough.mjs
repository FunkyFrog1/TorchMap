// Populates a NEW fictional project on an already running local service.
const base = process.env.TENSORMAP_URL || "http://127.0.0.1:18770";
let project = "default";
async function post(route, body) {
  const r = await fetch(base + "/api/" + route + "?project=" + project, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const v = await r.json();
  if (!r.ok) throw Error(v.error);
  return v;
}
project = (
  await post("projects", {
    schemaVersion: 1,
    title: "Signal Lab · fictional demo",
    nodes: [],
    edges: [],
  })
).id;
let n = 0;
const emit = (type, fields) =>
  post("events", {
    protocol: "tensormap/0.1",
    id: "demo-" + ++n,
    type,
    ...fields,
  });
for (const [id, title, date] of [
  ["base", "Baseline", "2026-01-05"],
  ["hold", "Delayed decay", "2026-01-08"],
]) {
  await post("versions", {
    node: {
      id,
      title,
      date,
      summary:
        id === "hold"
          ? "Hold the learning rate after step 40,000."
          : "Cosine schedule.",
      changes: ["Fictional scalar measurements"],
    },
    parents:
      id === "hold" ? [{ id: "base", kind: "finetune", label: "40K EMA" }] : [],
  });
  const runId = "train-" + id,
    common = { runId, attempt: 1 };
  await emit("run.created", {
    runId,
    versionId: id,
    kind: "train",
    config: { seed: 42 },
    ...(id === "hold" ? { checkpointId: "base-40000-ema" } : {}),
  });
  await emit("attempt.started", common);
  for (const [step, loss] of id === "base"
    ? [
        [10000, 1.4],
        [25000, 0.92],
        [40000, 0.71],
        [55000, 0.65],
      ]
    : [
        [40000, 0.71],
        [47500, 0.68],
        [55000, 0.61],
      ]) {
    await emit("metric", { ...common, step, name: "loss", value: loss });
    if (step < 40000) continue;
    const checkpointId = id + "-" + step + "-ema";
    await emit("checkpoint.saved", {
      ...common,
      checkpointId,
      step,
      weights: "ema",
      uri: "weights/" + checkpointId + ".pt",
    });
    const evalId = "eval-" + checkpointId,
      ev = { runId: evalId, attempt: 1 };
    await emit("run.created", {
      runId: evalId,
      versionId: id,
      kind: "eval",
      checkpointId,
      dataset: "heldout-v1",
      protocolId: "macro-v1",
    });
    await emit("attempt.started", ev);
    await emit("metric", {
      ...ev,
      step: 32,
      name: "accuracy_fraction",
      value: 1 - loss / 2,
    });
    await emit("attempt.ended", { ...ev, status: "succeeded" });
  }
  await emit("attempt.ended", { ...common, status: "succeeded" });
}
console.log(base + "/?project=" + project + "#hold");
