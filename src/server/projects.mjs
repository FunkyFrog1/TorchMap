import { replaceFile } from "./files.mjs";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  access,
  copyFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { normalizeProject } from "../core/graph.js";
import { Ledger } from "./ledger.mjs";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const json = (f) => readFile(f, "utf8").then(JSON.parse);
async function exists(f) {
  try {
    await access(f);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
const encode = (v) => JSON.stringify(v, null, 2) + "\n";
export class Projects {
  constructor(root) {
    this.root = root;
    this.ledgers = new Map();
    this.queue = Promise.resolve();
  }
  write(fn) {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
  dir(id) {
    if (id !== "default" && !uuid.test(id)) throw Error("Invalid project ID");
    return path.join(this.root, "projects", id);
  }
  async saveNew(id, map) {
    const dir = this.dir(id);
    await mkdir(path.dirname(dir), { recursive: true });
    await mkdir(dir);
    await writeFile(path.join(dir, "map.json"), encode(normalizeProject(map)), {
      flag: "wx",
    });
  }
  async initialize(legacy, example) {
    const marker = path.join(this.root, "workspace.json");
    if (await exists(marker)) {
      if ((await json(marker)).protocol !== "tensormap/0.1")
        throw Error("Unknown workspace format");
      return;
    }
    const oldDir = path.join(path.dirname(legacy), "projects");
    const sources = [["default", (await exists(legacy)) ? legacy : example]];
    if (await exists(oldDir))
      for (const f of await readdir(oldDir)) {
        if (f.endsWith(".json") && uuid.test(f.slice(0, -5)))
          sources.push([f.slice(0, -5), path.join(oldDir, f)]);
      }
    for (const [id, file] of sources) {
      if (!(await exists(path.join(this.dir(id), "map.json"))))
        await this.saveNew(id, await json(file));
    }
    await writeFile(
      marker,
      encode({
        protocol: "tensormap/0.1",
        createdAt: new Date().toISOString(),
      }),
      { flag: "wx" },
    );
  }
  async list() {
    const dirs = await readdir(path.join(this.root, "projects"), {
      withFileTypes: true,
    });
    return Promise.all(
      dirs
        .filter(
          (d) => d.isDirectory() && (d.name === "default" || uuid.test(d.name)),
        )
        .map(async (d) => {
          const m = await this.map(d.name);
          return { id: d.name, title: m.title, updatedAt: m.updatedAt };
        }),
    );
  }
  map(id) {
    return json(path.join(this.dir(id), "map.json"));
  }
  async ledger(id) {
    await access(path.join(this.dir(id), "map.json"));
    if (!this.ledgers.has(id)) {
      const pending = new Ledger(this.dir(id)).load().catch((err) => {
        this.ledgers.delete(id);
        throw err;
      });
      this.ledgers.set(id, pending);
    }
    return this.ledgers.get(id);
  }
  async save(id, raw, expected) {
    const m = normalizeProject(raw),
      previous = await this.map(id);
    if (expected != null && expected !== previous.updatedAt)
      throw Object.assign(
        Error("Map changed in another client. Reload before saving."),
        { status: 409 },
      );
    const ledger = await this.ledger(id),
      ids = new Set(m.nodes.map((n) => n.id));
    if (
      [...ledger.state.runs.values(), ...ledger.state.artifacts].some(
        (o) => !ids.has(o.versionId),
      )
    )
      throw Error(
        "A version with recorded runs or attachments cannot be removed",
      );
    m.updatedAt = new Date(
      Math.max(Date.now(), (Date.parse(previous.updatedAt) || 0) + 1),
    ).toISOString();
    const file = path.join(this.dir(id), "map.json"),
      tmp = file + "." + randomUUID() + ".tmp";
    await writeFile(tmp, encode(m));
    await copyFile(file, path.join(this.dir(id), "map.backup.json"));
    await replaceFile(tmp, file);
    return { savedAt: m.updatedAt };
  }
  async archive(id) {
    if (id === "default") throw Error("Cannot archive default project");
    if (
      [...(await this.ledger(id)).state.runs.values()].some(
        (r) => r.status === "running",
      )
    )
      throw Error("Finish running attempts before archiving");
    const dest = path.join(this.root, "archive");
    await mkdir(dest, { recursive: true });
    await rename(this.dir(id), path.join(dest, id));
    this.ledgers.delete(id);
  }
}
