import { randomUUID } from "node:crypto";
export async function api(store, url, method, body, request) {
  const route = method + " " + url.pathname,
    id = url.searchParams.get("project") || "default";
  if (route === "GET /api/health")
    return {
      application: "tensormap",
      protocol: store.readOnly ? "tensormap/directory-1" : "tensormap/0.1",
    };
  if (route === "GET /api/projects") return store.list();
  if (route === "POST /api/projects") {
    const key = randomUUID();
    await store.saveNew(key, body);
    return { id: key };
  }
  if (route === "DELETE /api/projects") {
    await store.archive(id);
    return { archived: true };
  }
  if (route === "GET /api/project") return store.map(id);
  if (route === "PUT /api/project")
    return store.save(id, body, request.headers["x-map-revision"]);
  if (route === "POST /api/versions") {
    const m = await store.map(id);
    m.nodes.push(body.node);
    for (const p of body.parents ?? [])
      m.edges.push({
        from: p.id,
        to: body.node.id,
        kind: p.kind ?? "branch",
        label: p.label ?? "",
      });
    return store.save(id, m);
  }
  const l = await store.ledger(id);
  if (route === "GET /api/snapshot") return l.snapshot();
  if (route === "GET /api/metrics") {
    const runId = url.searchParams.get("run");
    if (!l.state.runs.has(runId)) throw Error("Unknown run");
    const rows = l.series.get(runId) ?? [];
    const after = Number(url.searchParams.get("after") ?? 0);
    if (!Number.isSafeInteger(after) || after < 0)
      throw Error("Invalid cursor");
    const items = rows.slice(after, after + 1000);
    return {
      items,
      next: after + items.length,
      more: after + items.length < rows.length,
    };
  }
  if (route === "POST /api/events") return l.append(body, await store.map(id));
  if (route === "POST /api/artifacts")
    return l.attach(body, await store.map(id));
  throw Object.assign(Error("Unknown endpoint"), { status: 404 });
}
