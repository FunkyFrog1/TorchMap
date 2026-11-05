import {
  trainingView,
  evaluationView,
  el,
  tr,
} from "./monitor-views.js";
const views = ["training", "validation", "test", "roadmap", "details"];
const titles = () => [
  tr("训练", "Training"),
  tr("验证", "Validation"),
  tr("测试", "Test"),
  tr("模型路线图", "Model lineage"),
  tr("详情","Details"),
];
const iconPaths = [
  "M3 17h3l3-11 4 14 3-9h5",
  "M5 4h14v16H5z M8 12l3 3 5-6",
  "M8 3h8 M10 3v6l-6 10q0 2 2 2h12q2 0 2-2l-6-10V3 M8 15h8",
  "M3 4h6v5H3z M15 3h6v5h-6z M15 15h6v5h-6z M9 6h6 M11 6v11h4",
  "M5 3h10l4 4v14H5z M8 10h8 M8 14h8 M8 18h5",
];
function icon(d) {
  const ns = "http://www.w3.org/2000/svg",
    s = document.createElementNS(ns, "svg"),
    p = document.createElementNS(ns, "path");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  p.setAttribute("d", d);
  s.append(p);
  return s;
}
function readSession(k) {
  try {
    return sessionStorage.getItem(k) || "";
  } catch {
    return "";
  }
}
function saveSession(k, v) {
  try {
    sessionStorage.setItem(k, v);
  } catch {}
}
export function mountMonitor({
  projectId,
  getMap,
  getSelected,
  selectModel,
  onMapShown,
  setMiniPage,
  updateProgress,
  readOnly,
}) {
  const $ = (id) => document.getElementById(id),
    url = new URL(location.href),
    q = url.searchParams;
  const oldMetric = q.get("metric") ?? "",
    legacyDataset = oldMetric.includes(" / ") ? oldMetric.split(" / ")[0] : "";
  let page =
    q.get("view") ??
    (legacyDataset && legacyDataset !== "train"
      ? /test|sf20|测试/i.test(legacyDataset)
        ? "test"
        : "validation"
      : legacyDataset === "train"
        ? "training"
        : "details");
  if (!views.includes(page)) page = "details";
  let previousPage=page==="roadmap"?"details":page;
  let runId = q.get("run") ?? "";
  let linkPeers = q.has("peer") ? q.getAll("peer").filter(Boolean) : null;
  const comparisons = new Map();
  let snap = null,
    active = null,
    painting = 0,
    busy = false;
  const
    cache = new Map();
  const nav = el("nav", null, "monitor-nav"),
    navButtons = [];
  nav.setAttribute("aria-label", tr("项目页面", "Project views"));
  for (const [i, name] of views.entries()) {
    if(name==="roadmap")continue;
    const b = el("button");
    b.dataset.view = name;
    b.append(icon(iconPaths[i]), el("span"));
    b.onclick = () => changePage(name);
    navButtons.push(b);
    if (name === "details") nav.prepend(b);
    else nav.append(b);
  }
  document
    .querySelector(".project-sidebar")
    .insertBefore(nav, $("project-menu"));
  if (readOnly) $("project-menu").open = false;

  const menu = $("project-menu");
  menu.open = false;
  menu.prepend(document.querySelector(".sidebar-label"), $("project-picker"));
  const summary = menu.querySelector("summary");
  menu.prepend(summary);
  document.querySelector(".map-toolbar").append(menu);
  const main = el("main", null, "monitor-content"),
    body = el("div", null, "monitor-results"),
    notice = el("p", null, "monitor-notice");
  notice.setAttribute("role", "status");
  main.append(notice, body);
  const workspace = document.querySelector(".workspace");
  const dashboard = el("div", null, "project-dashboard");
  workspace.before(dashboard);
  const detailPage=el("section",null,"version-detail-page"),emptyDetail=el("p",null,"monitor-muted");
  detailPage.append($("inspector"),emptyDetail);
  dashboard.append(main, workspace, detailPage);
  document.body.classList.add("console-mode");
  const get = async (path, signal) => {
    const u = new URL("/api/" + path, location.href);
    u.searchParams.set("project", projectId);
    const r = await fetch(u, { signal });
    if (!r.ok) throw Error((await r.json()).error);
    return r.json();
  };
  function labelRun(r) {
    const m = getMap().nodes.find((n) => n.id === r.versionId);
    return (m?.title ?? r.versionId) + " · " + (r.folder ?? r.id);
  }
  function syncUrl() {
    const u = new URL(location.href);
    if (!readOnly && page === "details") u.searchParams.delete("view");
    else u.searchParams.set("view", page);
    if (runId) u.searchParams.set("run", runId);
    else u.searchParams.delete("run");
    for (const key of ["peer", "compare", "metric", "dataset", "group"])
      u.searchParams.delete(key);
    if (comparisons.has(runId))
      for (const id of comparisons.get(runId).length
        ? comparisons.get(runId)
        : [""])
        u.searchParams.append("peer", id);
    u.hash = getSelected() || "";
    history.replaceState(null, "", u);
  }
  const closeMap=el("button","×","map-close");
  closeMap.type="button";closeMap.title=tr("收起地图","Close map");
  closeMap.setAttribute("aria-label",closeMap.title);
  closeMap.onclick=()=>changePage(previousPage);
  document.querySelector(".map-toolbar").append(closeMap);
  let transition;
  function changePage(v) {
    if(v===page)return;
    const morph=v==="roadmap" || page==="roadmap";
    if(v==="roadmap")previousPage=page;
    const show=()=>{page=v;dashboard.scrollTop=0;draw();};
    if(!morph || !document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches){show();return;}
    if(transition)return;
    const root=document.documentElement;
    root.classList.add("map-morph");
    transition=document.startViewTransition(show);
    transition.finished.finally(()=>{root.classList.remove("map-morph");transition=null;});
  }
  async function points(r, signal) {
    const tag = [r.seriesRevision, r.updated, r.status, r.step, r.attempt].join(
        "|",
      ),
      hit = cache.get(r.id);
    if (hit?.tag === tag) return hit.rows;
    const rows = [];
    let after = 0;
    while (true) {
      const p = await get(
        "metrics?run=" + encodeURIComponent(r.id) + "&after=" + after,
        signal,
      );
      rows.push(...p.items);
      if (!p.more) break;
      after = p.next;
    }
    cache.set(r.id, { tag, rows });
    return rows;
  }
  let initial = true,
    wasMap = false,
    context = "";
  async function draw() {
    const seq = ++painting;
    active?.abort();
    active = new AbortController();
    const signal = active.signal;
    const map = getMap(),
      selected = getSelected(),
      isMap = page === "roadmap",
      labels = titles(),
      runs = snap?.runs ?? [];
    document.body.dataset.page = page;
    workspace.hidden = !isMap;
    setMiniPage(isMap);
    main.hidden = isMap || page==="details";
    detailPage.hidden=page!=="details";

    emptyDetail.hidden=Boolean(selected);
    emptyDetail.textContent=tr("请先在模型路线图中选择卡片。","Select a model on the map first.");
    navButtons.forEach((b, i) => {
      b.lastChild.textContent = labels[views.indexOf(b.dataset.view)];
      b.setAttribute(
        "aria-current",
        b.dataset.view === page ? "page" : "false",
      );
    });


    const own = runs.filter(
      (r) => r.kind === "train" && r.versionId === selected,
    );

    const wanted = own.some((r) => r.id === runId)
      ? runId
      : ("");
    const r =
      own.find((r) => r.id === wanted) ??
      own.find((r) => r.status === "running") ??
      own[0];

    if (snap) runId = r?.id ?? "";
    const parentIds = map.edges
      .filter((e) => e.to === selected)
      .map((e) => e.from);
    const ck = new Map((snap?.checkpoints ?? []).map((c) => [c.id, c]));
    const candidates = runs.filter((x) => x.kind === "train" && x.id !== r?.id);
    const sourceRun = ck.get(r?.checkpointId)?.runId;
    const defaults = parentIds
      .map((id) => {
        const parentRuns = candidates.filter((x) => x.versionId === id);
        return (
          parentRuns.find((x) => x.id === sourceRun) ||

          parentRuns[0]
        )?.id;
      })
      .filter(Boolean);
    const storageKey = "tm-compare:" + projectId + ":" + runId;
    if (snap && r && !comparisons.has(runId)) {
      if (linkPeers !== null) {
        comparisons.set(runId, linkPeers);
        linkPeers = null;
      } else {
        let saved;
        try {
          saved = JSON.parse(readSession(storageKey));
        } catch {}
        if (Array.isArray(saved)) comparisons.set(runId, saved);
      }
    }
    const ids = comparisons.get(runId) ?? defaults;
    const peers = candidates.filter((x) => ids.includes(x.id));
    if (snap) syncUrl();
    if (isMap && !wasMap) onMapShown();
    wasMap = isMap;
    if (isMap) {
      updateProgress(runs, runId);
      return;
    }
    if(page==="details")return;
    const next = [selected, runId, page, ...peers.map((p) => p.id)].join("|");
    if (next !== context) {
      body.replaceChildren();
      notice.textContent = tr("读取中…", "Loading…");
    }
    context = next;
    if (!snap) return;
    if (!r) {
      body.replaceChildren();
      notice.textContent = tr(
        selected
          ? "这个模型尚未登记训练 Run。"
          : "请在模型路线图中选择一张卡片。",
        selected ? "No runs registered." : "Select a card on the model map.",
      );
      return;
    }
    try {
      const samples = new Map(),
        evals = [];
      const allowed = new Set([r.id, ...peers.map((p) => p.id)]);
      if (page === "training") {
        await Promise.all(
          [r, ...peers].map(async (x) =>
            samples.set(x.id, await points(x, signal)),
          ),
        );
      } else {
        for (const e of runs) {
          if (e.kind !== "eval" || !allowed.has(ck.get(e.checkpointId)?.runId))
            continue;
          let finals = e.finalMetrics;
          if (!finals && e.status === "succeeded") {
            const all = await points(e, signal);
            finals = [
              ...new Map(
                all
                  .filter((p) => p.attempt === e.attempt)
                  .map((p) => [p.name, p]),
              ).values(),
            ];
          }
          evals.push({ ...e, finalMetrics: finals ?? [] });
        }
      }
      if (seq !== painting) return;
      const ctx = {
        view: page,
        run: r,
        weights: snap.checkpoints,
        weightById: ck,
        peers,
        samples,
        evals,

        runLabel: labelRun,
      };
      body.replaceChildren(
        ...(page === "training" ? trainingView(ctx) : evaluationView(ctx)),
      );
      if (page === "training") {
        const attached = (snap.artifacts ?? []).filter(
          (a) => a.versionId === selected && (!a.runId || a.runId === r.id),
        );
        if (attached.length) {
          const block = el("section", null, "monitor-panel");
          block.append(el("h2", tr("附件", "Attachments")));
          for (const a of attached) {
            const link = el("a", a.name);
            link.href =
              "/api/asset?" +
              new URLSearchParams({ project: projectId, id: a.id });
            link.target = "_blank";
            link.rel = "noopener";
            block.append(link, el("br"));
          }
          body.append(block);
        }
      }
      notice.textContent = r.stale
        ? tr("最近未收到运行心跳", "No recent run heartbeat")
        : "";
    } catch (e) {
      if (!signal.aborted)
        notice.textContent = tr("读取失败 · ", "Read failed · ") + e.message;
    }
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      snap = await get("snapshot");
      await draw();
    } catch (e) {
      notice.textContent = e.message;
    } finally {
      busy = false;
    }
  }

  draw();
  refresh();
  setInterval(() => {
    if (!document.hidden) refresh();
  }, 15000);
  const toggleMap=()=>changePage(page==="roadmap"?previousPage:"roadmap");
  document.addEventListener("keydown",e=>{if(e.key==="Escape" && page==="roadmap" && !document.querySelector("dialog[open]"))changePage(previousPage);});
  return {draw,changePage,toggleMap,page:()=>page};
}
