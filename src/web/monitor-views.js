import { language, setLanguage, tr } from "./i18n.js";
import { curve, experimentColor } from "./monitor-chart.js";
export { tr };
export function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
export function choices(select, items, desired) {
  const spec = JSON.stringify(items);
  if (select.dataset.options !== spec) {
    select.replaceChildren(
      ...items.map(([key, label]) => new Option(label, key)),
    );
    select.dataset.options = spec;
  }
  select.value = items.some(([key]) => key === desired)
    ? desired
    : (items[0]?.[0] ?? "");
  return select.value;
}
const number = (v) =>
  Number.isFinite(v)
    ? v.toLocaleString("en", { maximumFractionDigits: 3 })
    : "—";
export const states = (s) =>
  ({
    succeeded: tr("已完成", "Completed"),
    running: tr("训练中", "Running"),
    queued: tr("排队中", "Queued"),
    stopped: tr("已停止", "Stopped"),
    failed: tr("失败", "Failed"),
    partial: tr("部分完成", "Partial"),
  })[s] ?? tr("待核实", "Unknown");
function inferred(dataset) {
  if (/(^|[^a-z])(test|testing|sf20|benchmark)([^a-z]|$)|测试/i.test(dataset))
    return "test";
  if (/val(idation)?\d*|held.?out|holdout|验证/i.test(dataset))
    return "validation";
  return "";
}

const pinIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3h8l-1 7 3 3v2H6v-2l3-3zM12 15v6"/></svg>';
const expandedGroups=new Set();
function panels(groups, ctx) {
  const project=new URLSearchParams(location.search).get("project")||"default";
  const namespace=JSON.stringify([project,ctx.view]);
  const pinKey = "tm-card-pins:" + namespace;
  function readList(key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      return Array.isArray(saved) ? saved : null;
    } catch { return null; }
  }
  function readOverrides() {
    return new Map(readList(pinKey) ?? []);
  }
  let overrides = readOverrides();
  // Older clients saved bare metric names project-wide. Preserve their display
  // until a user makes a choice for a particular dataset/protocol/weight card.
  const oldNames = readList("tm-project-pins:" + project);
  const legacy = new Set(oldNames ?? readList("tm-pins:" + namespace) ?? []);
  function isPinned(id, group) {
    return overrides.get(id) ?? legacy.has(oldNames === null ? id : group.name);
  }
  const host=el("div",null,"metric-browser");
  function card(id,g){
    const panel=el("section",null,"monitor-panel metric-card");
    const heading=el("div",null,"metric-heading"),pin=el("button",null,"metric-pin");
    const marked=isPinned(id,g);pin.type="button";pin.setAttribute("aria-pressed",String(marked));
    pin.title=marked?tr("取消固定","Unpin"):tr("固定到顶部","Pin to top");pin.setAttribute("aria-label",pin.title+" · "+g.name);
    pin.innerHTML=pinIcon;
    pin.onclick = () => {
      overrides = readOverrides();
      overrides.delete(id);
      overrides.set(id, !marked);
      localStorage.setItem(pinKey, JSON.stringify([...overrides]));
      render();
    };
    const tools=el("div",null,"metric-tools"),zoom=el("div",null,"chart-actions");tools.append(zoom,pin);heading.append(el("h2",g.name),tools);panel.append(heading);
    if(g.scope)panel.append(el("small",g.scope,"monitor-muted"));
    panel.append(curve([...g.series.values()],g.name,"",JSON.stringify([namespace,ctx.run.id,id]),tr,zoom));return panel;
  }
  function render(){
    const top=el("section",null,"pin-section"),fixed=el("div",null,"scalar-grid");
    const title=el("h2",null,"pinned-symbol");title.innerHTML=pinIcon;title.setAttribute("aria-label",tr("已固定指标","Pinned metrics"));title.title=tr("已固定指标","Pinned metrics");top.append(title,fixed);
    const ordered = new Set([...groups.keys()].filter(id => !overrides.has(id)).concat([...overrides.keys()]));
    for (const id of ordered) {
      const group = groups.get(id);
      if (group && isPinned(id, group)) fixed.append(card(id, group));
    }
    if(!fixed.childElementCount)top.append(el("small",tr("从下方分组固定指标","Pin metrics from the groups below"),"monitor-muted"));
    host.replaceChildren(top);
    const buckets=new Map();
    for(const [id,g] of groups){
      const slash=g.name.lastIndexOf("/");
      const group=[g.scope,slash>0?g.name.slice(0,slash):""].filter(Boolean).join(" · ")||tr("标量","Scalars");
      if(!buckets.has(group))buckets.set(group,[]);buckets.get(group).push([id,g]);
    }
    for(const [name,entries] of buckets){
      const key=JSON.stringify([namespace,name]),details=el("details",null,"metric-group"),summary=el("summary",name+" · "+entries.length);
      details.append(summary);details.open=expandedGroups.has(key);
      function content(){details.querySelector(".scalar-grid")?.remove();if(details.open){const grid=el("div",null,"scalar-grid");for(const [id,g] of entries)grid.append(card(id,g));details.append(grid);}}
      content();details.ontoggle=()=>{if(!details.isConnected)return;if(details.open)expandedGroups.add(key);else expandedGroups.delete(key);if(details.open!==!!details.querySelector(".scalar-grid"))content();};
      host.append(details);
    }
    if(!groups.size)host.append(el("small",tr("暂无已记录的指标","No recorded metrics"),"monitor-muted"));
  }
  render();return [host];
}
function sample(groups, name, scope, label, step, value, run, attempt) {
  if (!Number.isFinite(value) || !Number.isFinite(step)) return;
  const key = JSON.stringify([scope, name]);
  if (!groups.has(key)) groups.set(key, { name, scope, series: new Map() });
  const seriesId = JSON.stringify([run.id, attempt]);
  const series = groups.get(key).series;
  if (!series.has(seriesId)) series.set(seriesId, { label, color: experimentColor(run.versionId || run.id), points: [] });
  series.get(seriesId).points.push([step, value]);
}
export function trainingView(ctx) {
  const groups = new Map();
  for (const run of [ctx.run, ...ctx.peers])
    for (const m of ctx.samples.get(run.id) ?? [])
      sample(
        groups,
        m.name,
        "",
        ctx.runLabel(run) + " #" + m.attempt,
        m.step,
        m.value, run, m.attempt,
      );
  return panels(groups,ctx);
}
export function evaluationView(ctx) {
  const groups = new Map(),
    runs = new Map([ctx.run, ...ctx.peers].map((r) => [r.id, r]));
  for (const e of ctx.evals) {
    if (
      e.status !== "succeeded" ||
      (e.split || inferred(e.dataset) || "validation") !== ctx.view
    )
      continue;
    const ck = ctx.weightById.get(e.checkpointId),
      run = runs.get(ck?.runId);
    if (!run) continue;
    const scope = [e.dataset, e.protocolId, ck.weights].join(" / ");
    for (const m of e.finalMetrics)
      sample(groups, m.name, scope, ctx.runLabel(run), ck.step, m.value, run);
  }
  return panels(groups,ctx);
}

export function settingsView(projectPicker, schedule) {
  const panel = el("section", null, "monitor-settings");
  function field(title, input) {
    const label = el("label", null, "settings-field");
    label.append(el("span", title), input);
    panel.append(label);
    return label;
  }
  panel.append(el("h2", tr("设置", "Settings")));
  const palettes = el("fieldset", null, "settings-palettes");
  palettes.append(el("legend", tr("主题色", "Accent color")));
  const options = [
    ["lagoon", tr("默认海蓝", "Lagoon")], ["dune", tr("磷光终端", "Phosphor Terminal")],
    ["coral", tr("期刊校样", "Journal Proof")], ["oasis", tr("实验手记", "Field Notes")],
    ["dusk", tr("深海蓝图", "Deep Blueprint")]
  ];
  for (const [id, name] of options) {
    const choice = el("label", null, "theme-choice");
    choice.dataset.palette = id;
    const radio = el("input");
    radio.type = "radio";
    radio.name = "monitor-theme";
    radio.value = id;
    radio.checked = document.documentElement.dataset.theme === id;
    radio.onchange = () => {
      document.documentElement.dataset.theme = id;
      localStorage.setItem("experiment-map:theme", id);
    };
    const swatch = el("span", null, "theme-swatch");
    swatch.setAttribute("aria-hidden", "true");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    line.setAttribute("viewBox", "0 0 80 22");
    const trace = document.createElementNS(line.namespaceURI, "polyline");
    trace.setAttribute("points", "0,17 10,16 17,9 25,13 34,6 43,9 51,4 61,7 70,4 80,3");
    line.append(trace);
    swatch.append(line);
    choice.append(radio, swatch, el("span", name));
    palettes.append(choice);
  }
  panel.append(palettes);
  const locale = el("select");
  choices(locale, [["zh-CN", "简体中文"], ["en", "English"], ["ja", "日本語"], ["fr", "Français"]], language());
  field(tr("语言", "Language"), locale);
  locale.onchange = () => { setLanguage(locale.value); location.reload(); };
  const interval = el("select");
  const key = "tm-refresh-seconds";
  choices(interval, [15, 30, 60, 300, 0].map(n => [
    String(n), n ? n + " " + tr("秒", "s") : tr("仅手动刷新", "Manual only")
  ]), localStorage.getItem(key) ?? "15");
  field(tr("自动刷新", "Auto-refresh"), interval);
  interval.onchange = () => {
    localStorage.setItem(key, interval.value);
    schedule(Number(interval.value));
  };
  const slot = el("span");
  field(tr("项目目录", "Project directory"), slot);
  const path = el("code");
  function updatePath() {
    path.textContent = projectPicker.selectedOptions[0]?.dataset.directory ?? "";
  }
  new MutationObserver(updatePath).observe(projectPicker, {childList: true});
  panel.append(el("h3", tr("各用户提交的模型卡", "Model cards by author")));
  const authors = el("dl");
  panel.append(authors);
  return {
    panel, seconds: () => Number(interval.value),
    show(nodes) {
      if (!slot.contains(projectPicker)) slot.append(projectPicker, path);
      updatePath();
      const counts = new Map();
      for (const node of nodes) {
        const author = node.creator?.trim() || tr("未署名", "Unattributed");
        counts.set(author, (counts.get(author) ?? 0) + 1);
      }
      authors.replaceChildren(...[...counts].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0]))
        .flatMap(([name,n]) => [el("dt", name), el("dd", n)]));
      if (!counts.size) authors.append(el("dt", tr("暂无模型卡", "No model cards yet")));
    }
  };
}
