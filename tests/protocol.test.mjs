import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  appendFile,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Projects } from "../src/server/projects.mjs";
import { service } from "../src/server/http.mjs";
import { spawn } from "node:child_process";
const map = {
  schemaVersion: 1,
  title: "Trial",
  nodes: [
    { id: "p", title: "P", date: "2025-01-01" },
    { id: "c", title: "C", date: "2025-01-02" },
  ],
  edges: [{ from: "p", to: "c", kind: "branch" }],
};
async function workspace(t) {
  const dir = await mkdtemp(path.join(tmpdir(), "tm-proto-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const old = path.join(dir, "old.json");
  await writeFile(old, JSON.stringify(map));
  const s = new Projects(path.join(dir, "new"));
  await s.initialize(old, old);
  return { s, dir, old };
}
test("train, resume, fork and evaluate one EMA checkpoint, replay without double counting", async (t) => {
  const { s, old } = await workspace(t),
    l = await s.ledger("default");
  let id = 0;
  const e = (type, p) => ({
    protocol: "tensormap/0.1",
    id: "e" + ++id,
    type,
    ...p,
  });
  const send = (type, p) => l.append(e(type, p), map);
  await send("run.created", { runId: "train", versionId: "p", kind: "train" });
  const a = { runId: "train", attempt: 1 };
  await send("attempt.started", a);
  await send("checkpoint.saved", {
    ...a,
    step: 40,
    weights: "ema",
    checkpointId: "ck",
    uri: "external/ck.pt",
  });
  const metric = e("metric", { ...a, step: 40, name: "loss", value: 0.2 });
  await l.append(metric, map);
  assert.equal((await l.append(metric, map)).duplicate, true);
  await assert.rejects(l.append({ ...metric, value: 9 }, map));
  await send("attempt.ended", { ...a, status: "failed" });
  await send("attempt.started", { ...a, attempt: 2, resumeFrom: "ck" });
  await assert.rejects(
    send("metric", { ...a, step: 41, name: "loss", value: 5 }),
  );
  await send("run.created", {
    runId: "child",
    versionId: "c",
    kind: "train",
    checkpointId: "ck",
  });
  await assert.rejects(
    send("run.created", {
      runId: "wrong",
      versionId: "c",
      kind: "eval",
      checkpointId: "ck",
      dataset: "ds",
      protocolId: "v1",
    }),
  );
  await send("run.created", {
    runId: "eval",
    versionId: "p",
    kind: "eval",
    checkpointId: "ck",
    dataset: "ds",
    protocolId: "v1",
  });
  await assert.rejects(
    s.save("default", { ...map, nodes: [map.nodes[1]], edges: [] }),
  );
  const art = {
    protocol: "tensormap/0.1",
    id: "note",
    versionId: "p",
    name: "Lab note",
    format: "md",
    content: Buffer.from("# Human note").toString("base64"),
  };
  await l.attach(art, map);
  assert.equal((await l.asset("note")).data.toString(), "# Human note");
  assert.equal((await l.attach(art, map)).duplicate, true);
  await assert.rejects(l.attach({ ...art, id: "badimg", format: "png" }, map));
  const s2 = new Projects(s.root);
  await appendFile(
    path.join(s.dir("default"), "events.jsonl"),
    '{"incomplete":',
  );
  assert.deepEqual((await s2.ledger("default")).snapshot(), l.snapshot());
  assert.equal((await s2.ledger("default")).series.get("train").length, 1);
  assert.ok(
    (await readdir(s.dir("default"))).some((x) => x.startsWith("partial-")),
  );
  assert.deepEqual(JSON.parse(await readFile(old, "utf8")), map);
  const unrelated = new Projects(s.root);
  await unrelated.initialize(old, old);
  assert.equal((await unrelated.list()).length, 1);
});
test("CLI exec records the actual child exit and leaves other projects isolated", async (t) => {
  const { s } = await workspace(t);
  const web = service(s, path.resolve("src"));
  await new Promise((ok) => web.listen(0, "127.0.0.1", ok));
  t.after(() => new Promise((ok) => web.close(ok)));
  const base = "http://127.0.0.1:" + web.address().port;
  const run = await fetch(base + "/api/events", {
    method: "POST",
    body: JSON.stringify({
      protocol: "tensormap/0.1",
      id: "create",
      type: "run.created",
      kind: "train",
      runId: "managed",
      versionId: "p",
    }),
  });
  assert.equal(run.status, 200);
  const child = spawn(
    process.execPath,
    [
      "src/cli.mjs",
      "exec",
      "managed",
      "1",
      "--",
      process.execPath,
      "-e",
      "process.exit(7)",
    ],
    {
      env: {
        ...process.env,
        TENSORMAP_URL: base,
        TENSORMAP_PROJECT: "default",
      },
      windowsHide: true,
      stdio: "ignore",
    },
  );
  assert.equal(await new Promise((resolve) => child.once("exit", resolve)), 7);
  const snap = await (await fetch(base + "/api/snapshot")).json();
  assert.equal(snap.runs[0].status, "failed");
  assert.equal(snap.runs[0].reason, "7");
  const other = await (
    await fetch(base + "/api/projects", {
      method: "POST",
      body: JSON.stringify(map),
    })
  ).json();
  assert.deepEqual(
    (await (await fetch(base + "/api/snapshot?project=" + other.id)).json())
      .runs,
    [],
  );
});
