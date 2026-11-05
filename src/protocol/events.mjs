// The same reducer validates incoming events and rebuilds a project after restart.
export const protocol = "tensormap/0.1";
export const blank = () => ({
  runs: new Map(),
  checkpoints: new Map(),
  artifacts: [],
});
export function required(value, label) {
  if (typeof value !== "string" || !value.trim())
    throw Error("Missing " + label);
  return value;
}
function key(value, label) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(required(value, label)))
    throw Error("Invalid " + label);
  return value;
}
function whole(value) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw Error("Expected a non-negative integer");
  return value;
}
function one(value, options) {
  if (!options.includes(value)) throw Error("Expected " + options.join(" / "));
  return value;
}
export function change(state, e, map) {
  const { runs, checkpoints, artifacts } = state;
  key(e.id, "event id");
  const version = (id) => {
    if (!map.nodes.some((v) => v.id === id))
      throw Error("Unknown version: " + id);
  };
  const checkpoint = (id) => {
    const c = checkpoints.get(id);
    if (!c) throw Error("Unknown checkpoint: " + id);
    return c;
  };
  const r = runs.get(e.runId);
  if (e.type === "run.created") {
    key(e.runId, "run id");
    version(e.versionId);
    one(e.kind, ["train", "eval"]);
    if (r) throw Error("Run already exists");
    if (e.kind === "eval") {
      required(e.dataset, "dataset");
      required(e.protocolId, "evaluation protocol");
      if (checkpoint(e.checkpointId).versionId !== e.versionId)
        throw Error("Evaluation must belong to its checkpoint version");
    } else if (e.checkpointId != null) {
      const from = checkpoint(e.checkpointId);
      if (
        from.versionId !== e.versionId &&
        !map.edges.some(
          (edge) => edge.from === from.versionId && edge.to === e.versionId,
        )
      )
        throw Error(
          "Training initialization must reference this version or a direct parent",
        );
    }
    return () =>
      runs.set(e.runId, {
        id: e.runId,
        versionId: e.versionId,
        kind: e.kind,
        checkpointId: e.checkpointId ?? null,
        dataset: e.dataset ?? "",
        protocolId: e.protocolId ?? "",
        config: e.config ?? {},
        status: "queued",
        attempt: 0,
        step: null,
        updated: e.at,
      });
  }
  if (e.type === "artifact.added") {
    version(e.versionId);
    if (e.runId != null && (!r || r.versionId !== e.versionId))
      throw Error("Artifact run/version mismatch");
    one(e.format, ["md", "png", "jpg"]);
    required(e.name, "artifact name");
    if (!/^[a-f0-9]{64}$/.test(e.digest)) throw Error("Invalid digest");
    return () =>
      artifacts.push({
        id: e.id,
        versionId: e.versionId,
        runId: e.runId ?? null,
        name: e.name,
        format: e.format,
        digest: e.digest,
        at: e.at,
      });
  }
  if (!r) throw Error("Unknown run: " + e.runId);
  if (e.type === "attempt.started") {
    if (
      !["queued", "failed", "stopped"].includes(r.status) ||
      e.attempt !== r.attempt + 1
    )
      throw Error("Cannot start this attempt");
    if (
      e.resumeFrom != null &&
      (r.kind !== "train" || checkpoint(e.resumeFrom).runId !== r.id)
    )
      throw Error("Resume must reference this training run");
    if (!r.attempt && e.resumeFrom != null)
      throw Error("Use run checkpointId for initial weights");
    return () =>
      Object.assign(r, {
        attempt: e.attempt,
        status: "running",
        updated: e.at,
        step: e.resumeFrom ? checkpoint(e.resumeFrom).step : null,
      });
  }
  if (e.attempt !== r.attempt || r.status !== "running")
    throw Error("Expected the current running attempt");
  if (e.type === "metric" || e.type === "heartbeat") {
    if (e.type === "metric" || e.step != null) whole(e.step);
    if (e.type === "metric") {
      required(e.name, "metric name");
      if (!Number.isFinite(e.value))
        throw Error("Metric must be a finite number");
    }
    return () =>
      Object.assign(r, {
        updated: e.at,
        step: e.step == null ? r.step : Math.max(e.step, r.step ?? 0),
      });
  }
  if (e.type === "checkpoint.saved") {
    if (r.kind !== "train") throw Error("Only training produces checkpoints");
    key(e.checkpointId, "checkpoint id");
    whole(e.step);
    required(e.uri, "checkpoint URI");
    required(e.weights, "weights");
    if (checkpoints.has(e.checkpointId))
      throw Error("Checkpoint id already registered");
    return () =>
      checkpoints.set(e.checkpointId, {
        id: e.checkpointId,
        runId: r.id,
        versionId: r.versionId,
        attempt: e.attempt,
        step: e.step,
        weights: e.weights,
        uri: e.uri,
      });
  }
  if (e.type === "attempt.ended") {
    one(e.status, ["succeeded", "failed", "stopped"]);
    return () =>
      Object.assign(r, {
        status: e.status,
        updated: e.at,
        reason: e.reason ?? "",
      });
  }
  throw Error("Unknown event type: " + e.type);
}
