import { replaceFile } from "./files.mjs";
import { appendFile, mkdir, readFile, writeFile, open } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { blank, change, protocol } from "../protocol/events.mjs";
const bytes = (x) => createHash("sha256").update(x).digest("hex");
const clean = (e) => {
  const { at, ...payload } = e;
  return payload;
};
export class Ledger {
  constructor(dir) {
    this.dir = dir;
    this.state = blank();
    this.ids = new Map();
    this.series = new Map();
  }
  async load() {
    let bytesOnDisk;
    try {
      bytesOnDisk = await readFile(path.join(this.dir, "events.jsonl"));
    } catch (e) {
      if (e.code === "ENOENT") return this;
      throw e;
    }
    const end = bytesOnDisk.lastIndexOf(10) + 1;
    if (end < bytesOnDisk.length) {
      // A killed writer can leave a partial last append. Keep it before truncation.
      await writeFile(
        path.join(this.dir, "partial-" + randomUUID() + ".bin"),
        bytesOnDisk.subarray(end),
      );
      const f = await open(path.join(this.dir, "events.jsonl"), "r+");
      try {
        await f.truncate(end);
      } finally {
        await f.close();
      }
    }
    // Membership was validated against the map at append time. Replay the historical membership, not today's layout.
    for (const line of bytesOnDisk
      .subarray(0, end)
      .toString("utf8")
      .split("\n")
      .filter(Boolean)) {
      const e = JSON.parse(line);
      if (e.protocol !== protocol || this.ids.has(e.id))
        throw Error("Invalid journal record: " + e.id);
      const replay = {
        nodes: [{ id: e.versionId }],
        edges: [
          {
            from: this.state.checkpoints.get(e.checkpointId)?.versionId,
            to: e.versionId,
          },
        ],
      };
      this.index(e, change(this.state, e, replay));
    }
    return this;
  }
  index(e, apply) {
    apply();
    this.ids.set(e.id, e);
    if (e.type === "metric") {
      if (!this.series.has(e.runId)) this.series.set(e.runId, []);
      this.series.get(e.runId).push(e);
    }
  }
  async append(payload, map, asset = false) {
    if (payload?.protocol !== protocol)
      throw Error("Expected protocol " + protocol);
    if (payload.type === "artifact.added" && !asset)
      throw Error("Use artifact upload");
    const e = { ...payload, at: new Date().toISOString() };
    const old = this.ids.get(e.id);
    if (old) {
      if (!isDeepStrictEqual(clean(old), clean(e)))
        throw Error("Event ID already used with a different payload");
      return { id: e.id, duplicate: true };
    }
    const apply = change(this.state, e, map);
    await mkdir(this.dir, { recursive: true });
    await appendFile(
      path.join(this.dir, "events.jsonl"),
      JSON.stringify(e) + "\n",
    );
    this.index(e, apply);
    return { id: e.id, duplicate: false };
  }
  async attach({ content, ...payload }, map) {
    if (typeof content !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(content))
      throw Error("Expected base64 content");
    const data = Buffer.from(content, "base64");
    if (data.length > 4 * 1024 * 1024) throw Error("Attachment exceeds 4 MiB");
    if (
      payload.format === "png" &&
      !data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    )
      throw Error("Not a PNG");
    if (payload.format === "jpg" && data.readUInt16BE(0) !== 0xffd8)
      throw Error("Not a JPEG");
    if (payload.format === "md")
      new TextDecoder("utf8", { fatal: true }).decode(data);
    const e = { ...payload, type: "artifact.added", digest: bytes(data) };
    if (payload.protocol !== protocol)
      throw Error("Expected protocol " + protocol);
    change(this.state, e, map);
    if (this.ids.has(e.id)) return this.append(e, map, true);
    const dir = path.join(this.dir, "assets");
    await mkdir(dir, { recursive: true });
    const target = path.join(dir, e.digest + "." + e.format);
    const tmp = path.join(dir, randomUUID() + ".tmp");
    await writeFile(tmp, data);
    await replaceFile(tmp, target);
    return this.append(e, map, true);
  }
  async asset(id) {
    const a = this.state.artifacts.find((x) => x.id === id);
    if (!a) throw Error("Unknown artifact");
    return {
      format: a.format,
      data: await readFile(
        path.join(this.dir, "assets", a.digest + "." + a.format),
      ),
    };
  }
  snapshot() {
    const { runs, checkpoints, artifacts } = this.state;
    return {
      protocol,
      runs: [...runs.values()].map((r) => ({
        ...r,
        stale:
          r.status === "running" && Date.now() - Date.parse(r.updated) > 120000,
      })),
      checkpoints: [...checkpoints.values()],
      artifacts,
    };
  }
}
