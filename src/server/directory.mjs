import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { normalizeProject } from "../core/graph.js";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const optional = async (op, empty) => {
  try {
    return await op();
  } catch (e) {
    if (e.code === "ENOENT") return empty;
    throw e;
  }
};
const folders = async (dir) =>
  (await optional(() => readdir(dir, { withFileTypes: true }), []))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
const manifest = (dir, name) =>
  optional(() => json(path.join(dir, name)), null);
function insert(map, key, value) {
  if (!key || map.has(key)) throw Error("Missing or duplicate ID: " + key);
  map.set(key, value);
}
async function scalars(dir, run) {
  const raw = await optional(
    () => readFile(path.join(dir, "metrics.jsonl"), "utf8"),
    "",
  );
  const rows = raw.split("\n");
  rows.pop(); // Only newline-terminated records are published.
  const cutoffs = new Map();
  let cutoff = Infinity;
  for (const a of [...(run.attempts ?? [])].sort(
    (a, b) => b.number - a.number,
  )) {
    cutoffs.set(a.number, cutoff);
    if (a.number > 1) cutoff = Math.min(cutoff, a.resume_step ?? -1);
  }
  const values = new Map();
  for (const line of rows) {
    if (!line.trim()) continue;
    const p = JSON.parse(line);
    if (p.step > (cutoffs.get(p.attempt) ?? Infinity)) continue;
    for (const [name, value] of Object.entries(p.metrics)) {
      if (!Number.isFinite(value)) continue;
      values.set(JSON.stringify([p.attempt, p.step, name]), {
        attempt: p.attempt,
        step: p.step,
        name,
        value,
      });
    }
  }
  return [...values.values()];
}

async function loadDirectory(dir, project) {
  const nodes = [],
    edges = [],
    runs = new Map(),
    weights = new Map(),
    series = new Map();
  for (const date of (await folders(dir)).filter((day) =>
    /^\d{4}-\d\d-\d\d$/.test(day),
  )) {
    for (const name of (await folders(path.join(dir, date))).filter((n) =>
      /^\d{3}_./.test(n),
    )) {
      const base = path.join(dir, date, name),
        v = await manifest(base, "version.json");
      if (!v) continue;
      if (v.date !== date) throw Error("Version date mismatch: " + name);
      const changeDetails = await optional(() => readFile(path.join(base, "changes.md"), "utf8"), "");
      nodes.push({ ...v, changeDetails, row: project.layout?.[v.id]?.row });
      for (const p of v.parents ?? []) {
        const rel = typeof p === "string" ? { id: p } : p;
        edges.push({
          from: rel.id,
          to: v.id,
          kind: rel.kind ?? "branch",
          label: rel.label ?? "",
        });
      }
      const root = path.join(base, "runs");
      for (const folder of await folders(root)) {
        const rd = path.join(root, folder),
          r = await manifest(rd, "run.json");
        if (!r) continue;
        if (r.version_id !== v.id) throw Error("Run version mismatch: " + r.id);
        const resolved = await manifest(rd, "config.json");
        const sourceYaml = await optional(() => readFile(path.join(rd, "config.yaml"), "utf8"), null);
        const stamp = Date.parse(r.last_seen);
        insert(runs, r.id, {
          id: r.id,
          versionId: v.id,
          kind: "train",
          config: resolved ?? r.config ?? null,
          configSource: resolved !== null ? "config.json" : r.config != null ? "run.json" : null,
          sourceYaml,
          folder,
          total: r.total,
          epoch:r.epoch,
          totalEpochs:r.total_epochs,
          evalPlan: r.eval_plan,
          attempt: r.attempt ?? 1,
          step: r.step,
          status: r.status,
          checkpointId: r.init_from ?? null,
          stale:
            r.status === "running" &&
            (!Number.isFinite(stamp) || Date.now() - stamp > 120000),
        });
        series.set(r.id, await scalars(rd, r));
        runs.get(r.id).seriesRevision = createHash("sha256")
          .update(JSON.stringify(series.get(r.id)))
          .digest("hex")
          .slice(0, 20);
        for (const c of r.checkpoints ?? [])
          insert(weights, c.id, { ...c, versionId: v.id, runId: r.id });
        for (const eFolder of await folders(path.join(rd, "evals"))) {
          if (r.evaluations && !r.evaluations.includes(eFolder)) continue;
          const ed = path.join(rd, "evals", eFolder),
            e = await manifest(ed, "eval.json");
          if (!e) continue;
          if (weights.get(e.checkpoint_id)?.runId !== r.id)
            throw Error("Evaluation checkpoint mismatch: " + e.id);
          const done = e.status === "succeeded",
            s = done ? await json(path.join(ed, "summary.json")) : null;
          const item = {
            id: e.id,
            versionId: v.id,
            kind: "eval",
            checkpointId: e.checkpoint_id,
            dataset: e.dataset,
            split: e.split ?? project.datasets?.[e.dataset]?.split,
            protocolId: e.protocol,
            status: e.status,
            step: e.progress?.done ?? null,
            attempt: e.attempt ?? 1,
            progress: e.progress,
            summary: s,
          };
          insert(runs, e.id, item);
          const points = Object.entries(s?.metrics ?? {})
            .filter(([, v]) => Number.isFinite(v))
            .map(([name, value]) => ({
              name,
              value,
              step: item.step ?? 0,
              attempt: item.attempt,
            }));
          item.finalMetrics = points;
          series.set(e.id, points);
        }
      }
    }
  }
  const map = normalizeProject({
    schemaVersion: 1,
    title: project.title,
    description: project.description,
    nodes,
    edges,
  });
  for (const r of runs.values()) {
    if (r.kind === "train" && r.checkpointId) {
      const p = weights.get(r.checkpointId);
      if (
        !p ||
        (p.versionId !== r.versionId &&
          !edges.some((e) => e.from === p.versionId && e.to === r.versionId))
      )
        throw Error("Unresolved initial checkpoint: " + r.id);
    }
  }
  return {
    map: { ...map, directoryMode: true },
    state: { runs },
    series,
    snapshot: () => ({
      protocol: "tensormap/directory-1",
      runs: [...runs.values()],
      checkpoints: [...weights.values()],
      artifacts: [],
    }),
  };
}
export class DirectoryStore {
  constructor(root) {
    this.root = root;
    this.readOnly = true;
    this.cache = new Map();
  }
  async catalog() {
    const items = new Map();
    for (const name of await folders(this.root)) {
      const dir = path.join(this.root, name),
        p = await manifest(dir, "project.json");
      if (p?.protocol === "tensormap/directory-1")
        insert(items, p.id, { dir, p });
    }
    return items;
  }
  async list() {
    return [...(await this.catalog()).values()].map(({ p }) => ({
      id: p.id,
      title: p.title,
    }));
  }
  async ledger(id) {
    const hit = this.cache.get(id);
    if (hit && hit.until > Date.now()) return hit.value;
    const items = await this.catalog(),
      item = id === "default" ? items.values().next().value : items.get(id);
    if (!item) throw Error("Unknown directory project: " + id);
    const value = loadDirectory(item.dir, item.p);
    this.cache.set(id, { until: Date.now() + 30000, value });
    try {
      return await value;
    } catch (e) {
      this.cache.delete(id);
      throw e;
    }
  }
  async map(id) {
    return (await this.ledger(id)).map;
  }
}
