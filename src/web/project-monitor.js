import {
  settingsView,
  trainingView,
  evaluationView,
  el,
  tr,
} from "./monitor-views.js";
const views = ["training", "validation", "test", "roadmap", "config", "settings"];
const titles = () => [
  tr("训练", "Training"),
  tr("验证", "Validation"),
  tr("测试", "Test"),
  tr("模型路线图", "Model lineage"),
  tr("配置","Configuration"),
  tr("设置", "Settings"),
];
const iconPaths = [
  "M3 17h3l3-11 4 14 3-9h5",
  "M5 4h14v16H5z M8 12l3 3 5-6",
  "M8 3h8 M10 3v6l-6 10q0 2 2 2h12q2 0 2-2l-6-10V3 M8 15h8",
  "M3 4h6v5H3z M15 3h6v5h-6z M15 15h6v5h-6z M9 6h6 M11 6v11h4",
  "M3 7h6m4 0h8M9 4v6M3 17h11m4 0h3m-7-3v6",
  "M4 8h16M4 16h16 M8 5v6 M16 13v6",
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
export function mountMonitor({
  projectId,
  getMap,
  getSelected,
  getCompareVersions,
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
        : "training");
  if (!views.includes(page)) page = "training";
  let previousPage=page==="roadmap"?"training":page;
  let runId = q.get("run") ?? "";
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
    if (name === "config") nav.prepend(b);
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
  const refreshBar = el("div", null, "monitor-refresh");
  const updated = el("span", tr("正在获取数据…", "Fetching data…"));
  const reload = el("button", tr("↻ 刷新", "↻ Refresh"));
  reload.type = "button";
  reload.onclick = refresh;
  refreshBar.append(updated, reload);
  main.append(refreshBar, notice, body);
  const workspace = document.querySelector(".workspace");
  const dashboard = el("div", null, "project-dashboard");
  workspace.before(dashboard);
  const detailPage=el("section",null,"version-detail-page"),emptyDetail=el("p",null,"monitor-muted");
  detailPage.append($("inspector"),emptyDetail);
  const configPanel = el("section", null, "run-config");

  let configSignature;
  const center = el("div", null, "monitor-center");
  const projectPicker = $("project-picker");
  const projectLabel = menu.querySelector(".sidebar-label");
  let timer;
  function schedule(seconds) {
    clearInterval(timer);
    if (seconds) timer = setInterval(() => { if (!document.hidden) refresh(); }, seconds * 1000);
  }
  const settings = settingsView(projectPicker, schedule);
  center.append(main, configPanel, settings.panel);
  const divider = el("div", null, "detail-divider");
  divider.tabIndex = 0;
  divider.setAttribute("role", "separator");
  divider.setAttribute("aria-orientation", "vertical");
  divider.setAttribute("aria-label", tr("调整详情栏宽度","Resize details"));
  const sizeKey = "tm-detail-width";
  function resize(width) {
    const min = Math.min(180, Math.round(dashboard.clientWidth * 0.32));
    const max = Math.max(min, Math.round(dashboard.clientWidth * 0.55));
    const value = Math.round(Math.max(min, Math.min(max, width)));
    dashboard.style.setProperty("--detail-width", value + "px");
    divider.setAttribute("aria-valuemin", min);
    divider.setAttribute("aria-valuemax", max);
    divider.setAttribute("aria-valuenow", value);
    return value;
  }
  dashboard.append(center, divider, detailPage, workspace);
  const restoreWidth = () => {
    if (!divider.hidden && dashboard.clientWidth)
      resize(Number(localStorage.getItem(sizeKey)) || Math.min(325, dashboard.clientWidth * 0.23));
  };
  new ResizeObserver(restoreWidth).observe(dashboard);
  divider.onpointerdown = e => {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    divider.setPointerCapture(e.pointerId);
  };
  divider.onpointermove = e => {
    if (divider.hasPointerCapture(e.pointerId))
      resize(dashboard.getBoundingClientRect().right - e.clientX);
  };
  divider.onpointerup = e => {
    if (divider.hasPointerCapture(e.pointerId))
      localStorage.setItem(sizeKey, divider.getAttribute("aria-valuenow"));
  };
  divider.onkeydown = e => {
    if (!["ArrowLeft","ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    localStorage.setItem(sizeKey, resize(detailPage.offsetWidth + (e.key === "ArrowLeft" ? 16 : -16)));
  };
  detailPage.setAttribute("aria-label", tr("模型详情", "Model details"));
  document.body.classList.add("console-mode");
  selectModel(getSelected());
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
    u.searchParams.set("view", page);
    if (runId) u.searchParams.set("run", runId);
    else u.searchParams.delete("run");
    for (const key of ["peer", "compare", "metric", "dataset", "group"])
      u.searchParams.delete(key);
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
    const show=()=>{page=v;center.scrollTop=0;draw();};
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
    center.hidden = isMap;
    main.hidden = isMap || page==="config" || page==="settings";
    settings.panel.hidden = page !== "settings";
    if (page === "settings") settings.show(map.nodes);
    else if (!menu.contains(projectPicker)) projectLabel.after(projectPicker);
    configPanel.hidden = page !== "config";
    divider.hidden = isMap || page === "settings";
    detailPage.hidden = divider.hidden;
    if (!isMap && wasMap) restoreWidth();

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
    const ck = new Map((snap?.checkpoints ?? []).map((c) => [c.id, c]));
    const candidates = runs.filter((x) => x.kind === "train" && x.id !== r?.id);
    const sourceRun = ck.get(r?.checkpointId)?.runId;
    const peers = [];
    for (const version of new Set(getCompareVersions())) {
      const ownRuns = candidates.filter(x => x.versionId === version && version !== selected);
      const peer = ownRuns.find(x => x.id === sourceRun)
        ?? ownRuns.find(x => x.status === "running") ?? ownRuns[0];
      if (peer) peers.push(peer);
    }
    if (snap) syncUrl();
    if (isMap && !wasMap) onMapShown();
    wasMap = isMap;
    if (isMap) {
      updateProgress(runs, runId);
      return;
    }
    if (page === "settings") return;
    if (page === "config") {
      const note = map.nodes.find(n => n.id === selected)?.configuration;
      const configs = r ? [r, ...peers].map(run => ({
        name: labelRun(run), data: run.config, source: run.configSource, yaml: run.sourceYaml
      })) : [];
      const signature = JSON.stringify([selected, note, Boolean(snap), configs]);
      if (signature !== configSignature) {
        configSignature = signature;
        configPanel.replaceChildren();
        if (note) configPanel.append(el("h3", tr("配置说明","Configuration notes")), el("p",note,"preserve-lines"));
        if (configs.length) renderConfig(configPanel, configs);
        else configPanel.append(el("p", !selected ? emptyDetail.textContent : !snap ? tr("读取中…","Loading…") : tr("尚无已登记的训练 Run","No registered training run."), "monitor-muted"));
      }
      return;
    }
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
      notice.textContent = "";
    } catch (e) {
      if (!signal.aborted)
        notice.textContent = tr("读取失败 · ", "Read failed · ") + e.message;
    }
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    reload.disabled = true;
    try {
      snap = await get("snapshot");
      const time = new Date();
      updated.textContent = tr("上次更新 ", "Last updated ") + time.toLocaleTimeString(document.documentElement.lang, {hour12:false});
      updated.title = time.toLocaleString(document.documentElement.lang);
      await draw();
    } catch (e) {
      notice.textContent = tr("刷新失败 · ", "Refresh failed · ") + e.message;
    } finally {
      busy = false;
      reload.disabled = false;
    }
  }

  draw();
  refresh();
  schedule(settings.seconds());
  const toggleMap=()=>changePage(page==="roadmap"?previousPage:"roadmap");
  document.addEventListener("keydown",e=>{if(e.key==="Escape" && page==="roadmap" && !document.querySelector("dialog[open]"))changePage(previousPage);});
  return {draw,changePage,toggleMap,page:()=>page};
}

function renderConfig(panel, configs) {
  const primary = configs[0];
  panel.append(el("h3", tr("训练配置", "Training configuration")));
  function section(title, content) {
    const group = el("details");
    group.append(el("summary", title), content);
    panel.append(group);
  }
  function fields(value, prefix = [], result = new Map()) {
    if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length) {
      for (const [name, child] of Object.entries(value))
        fields(child, [...prefix, name], result);
    } else result.set(JSON.stringify(prefix), JSON.stringify(value));
    return result;
  }
  const rows = configs.map(c => c.data == null ? new Map() : fields(c.data));
  const keys = new Set(rows.flatMap(row => [...row.keys()]));
  const missing = tr("未记录", "Unrecorded");
  if (configs.length > 1 && keys.size) {
    const table = el("table");
    const head = table.createTHead().insertRow();
    for (const title of [tr("参数", "Parameter"), ...configs.map(c => c.name)])
      head.append(el("th", title));
    const body = table.createTBody();
    for (const key of [...keys].sort()) {
      const values = rows.map(row => row.get(key) ?? missing);
      if (values.every(v => v === values[0])) continue;
      const row = body.insertRow();
      for (const text of [JSON.parse(key).join("."), ...values]) row.insertCell().textContent = text;
    }
    section(tr("配置差异", "Configuration differences") + " · " + body.rows.length,
      body.rows.length ? table : el("p", tr("已记录字段相同", "Recorded fields match")));
  }
  if (primary.data != null) {
    const title = primary.source === "config.json" ? tr("实际运行配置", "Resolved configuration") : tr("已登记字段（完整性未知）", "Registered fields (coverage unknown)");
    section(title, el("pre", JSON.stringify(primary.data, null, 2)));
  } else panel.append(el("p", tr("未记录实际运行配置", "Resolved configuration unavailable")));
  if (primary.yaml != null) section("config.yaml", el("pre", primary.yaml));
}
