import { createHash } from "node:crypto";

const hash = (value) => createHash("sha256").update(value).digest("base64url");
const withMetrics = new Set(["validation", "test"]);

export function monitorSnapshot(snapshot, view, versions) {
  const train = snapshot.runs.filter((r) => r.kind === "train");
  const detail = train.filter((r) => versions.has(r.versionId));
  const detailedIds = new Set(detail.map((r) => r.id));
  const parents = new Set(detail.map((r) => r.checkpointId));
  const owned = snapshot.checkpoints.filter((c) => detailedIds.has(c.runId));
  const ownedIds = new Set(owned.map((c) => c.id));
  const checkpoints = snapshot.checkpoints
    .filter((c) => ownedIds.has(c.id) || parents.has(c.id))
    .map(({ id, runId, versionId, step, weights }) => ({
      id,
      runId,
      versionId,
      step,
      weights,
    }));
  const runs = [];
  for (const run of snapshot.runs) {
    if (run.kind === "train") {
      if (!detailedIds.has(run.id) && view !== "roadmap") continue;
      const {
        config,
        configSource,
        sourceYaml,
        evalPlan,
        seriesRevision,
        ...row
      } = run;
      if (detailedIds.has(run.id)) {
        row.evalPlan = evalPlan;
        if (view === "training") row.seriesRevision = seriesRevision;
        if (view === "config")
          Object.assign(row, { config, configSource, sourceYaml });
      }
      runs.push(row);
    } else if (ownedIds.has(run.checkpointId)) {
      const { summary, finalMetrics, ...row } = run;
      if (withMetrics.has(view)) row.finalMetrics = finalMetrics;
      runs.push(row);
    }
  }
  const artifacts =
    view === "training"
      ? snapshot.artifacts.filter((a) => versions.has(a.versionId))
      : [];
  return { runs, checkpoints, artifacts };
}

// Retain fingerprints only. A slow or returning client outside the retained
// history receives a self-contained baseline for its current view.
export class MonitorHistory {
  entries = new Map();
  retainedRows = 0;

  reply(key, groups, since) {
    const indices = new Map();
    const total = createHash("sha256");
    let size = 0;
    for (const [name, rows] of Object.entries(groups)) {
      const index = new Map();
      total.update(JSON.stringify(name));
      for (const row of rows) {
        const digest = hash(JSON.stringify(row));
        index.set(row.id, digest);
        total.update(digest);
      }
      indices.set(name, index);
      size += index.size;
    }
    const revision = total.digest("base64url");
    const history = this.entries.get(key) ?? new Map();
    const base = history.get(since);
    this.entries.delete(key);
    this.entries.set(key, history);
    if (!history.has(revision)) {
      history.set(revision, { indices, size });
      this.retainedRows += size;
      if (history.size > 4) {
        const oldest = history.keys().next().value;
        this.retainedRows -= history.get(oldest).size;
        history.delete(oldest);
      }
    }
    while (
      this.entries.size > 64 ||
      (this.retainedRows > 300000 && this.entries.size > 1)
    ) {
      const oldest = this.entries.keys().next().value;
      for (const entry of this.entries.get(oldest).values())
        this.retainedRows -= entry.size;
      this.entries.delete(oldest);
    }
    if (revision === since) return { revision };
    if (!base) return { revision, full: groups };
    const changes = {};
    for (const [name, rows] of Object.entries(groups)) {
      const before = base.indices.get(name),
        after = indices.get(name);
      const put = rows.filter(
        (row) => before.get(row.id) !== after.get(row.id),
      );
      const remove = [...before.keys()].filter((id) => !after.has(id));
      const expectedOrder = [...before.keys()]
        .filter((id) => after.has(id))
        .concat(put.filter((row) => !before.has(row.id)).map((row) => row.id));
      const reordered = rows.some((row, i) => row.id !== expectedOrder[i]);
      if (put.length || remove.length || reordered) {
        changes[name] = { put, remove };
        if (reordered) changes[name].order = [...after.keys()];
      }
    }
    return { revision, changes };
  }
}
