import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { service } from "../src/server/http.mjs";

test("directory layouts survive reload and stay private to a browser and project", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "torchmap-layout-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = { readOnly: true, map: async () => ({ nodes: [{ id: "a" }] }) };
  const server = service(store, path.resolve("src"), { layoutRoot: root });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const api = "http://127.0.0.1:" + server.address().port + "/api/";
  const url = api + "board-layout?project=demo";
  const first = await fetch(url);
  assert.equal(await first.json(), null);
  const cookie = first.headers.get("set-cookie").split(";")[0];
  const desired = {
    mode: "generation",
    rows: { a: 1 },
    generationRows: { a: -1 },
  };
  const saved = await fetch(url, {
    method: "PUT",
    headers: { cookie },
    body: JSON.stringify(desired),
  });
  assert.deepEqual(await saved.json(), desired);
  assert.deepEqual(
    await (await fetch(url, { headers: { cookie } })).json(),
    desired,
  );
  assert.equal(await (await fetch(url)).json(), null);
  assert.equal(
    await (
      await fetch(api + "board-layout?project=another", { headers: { cookie } })
    ).json(),
    null,
  );
  assert.equal(
    (
      await fetch(api + "project?project=demo", {
        method: "PUT",
        headers: { cookie },
      })
    ).status,
    405,
  );
});
