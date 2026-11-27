import { language, setLanguage, tr } from "./i18n.js";
import { curve, experimentColor } from "./monitor-chart.js";
import { metricTime, latestMetricTime } from "./metric-time.js";
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
export const states = (s, phase) =>
  ({
    succeeded: tr("已完成", "Completed"),
    complete: tr("已完成", "Completed"),
    running: {
      validation: tr("验证中", "Validating"),
      test: tr("测试中", "Testing"),
    }[phase] ?? tr("训练中", "Running"),
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
const evaluationSplit = (dataset, split) =>
  split || inferred(dataset) || "validation";

export function runProgress(run, evaluations, checkpoints) {
  let training = null;
  if (
    Number.isFinite(run.step) &&
    Number.isFinite(run.total) &&
    run.total > 0
  ) {
    const value = Math.max(0, Math.min(run.step, run.total));
    const percent = (100 * value) / run.total;
    const text =
      value === run.total
        ? "100%"
        : value > 0 && percent < 0.1
          ? "<0.1%"
          : Math.min(99.9, percent).toLocaleString(undefined, {
              maximumFractionDigits: 1,
            }) + "%";
    const steps =
      number(value) + " / " + number(run.total) + tr(" 步", " steps");
    training = { value, total: run.total, text, steps };
  }
  const own = evaluations.filter(
    (e) =>
      e.kind === "eval" && checkpoints.get(e.checkpointId)?.runId === run.id,
  );
  const splits = new Map(
    own.map((e) => [e.dataset, e.split]).filter(([, split]) => split),
  );
  const buckets = new Map([
    ["validation", new Map()],
    ["test", new Map()],
  ]);
  const key = (dataset, step) => JSON.stringify([dataset, step]);
  for (const [dataset, steps] of Object.entries(run.evalPlan ?? {})) {
    if (!Array.isArray(steps)) continue;
    const bucket = buckets.get(evaluationSplit(dataset, splits.get(dataset)));
    for (const step of steps) bucket?.set(key(dataset, step), 0);
  }
  for (const e of own) {
    const bucket = buckets.get(evaluationSplit(e.dataset, e.split));
    if (!bucket) continue;
    const id = key(e.dataset, checkpoints.get(e.checkpointId).step);
    const { done, total } = e.progress ?? {};
    const fraction =
      e.status === "succeeded"
        ? 1
        : Number.isFinite(done) && Number.isFinite(total) && total > 0
          ? Math.min(0.99, Math.max(0, done / total))
          : 0;
    bucket.set(id, Math.max(bucket.get(id) ?? 0, fraction));
  }
  return [
    training,
    ...[...buckets.values()].map((bucket) => {
      if (!bucket.size) return null;
      const progress = [...bucket.values()];
      const complete = progress.filter((value) => value === 1).length;
      return {
        value: progress.reduce((sum, value) => sum + value, 0),
        total: bucket.size,
        text: complete + " / " + bucket.size,
      };
    }),
  ];
}

export function showRunProgress(panel, name, run, evaluations, checkpoints) {
  panel.hidden = !run;
  if (!run) return;
  const title = el("p", name, "sidebar-progress-title");
  title.title = name;
  const items = el("div", null, "sidebar-progress-items");
  const labels = [
    tr("训练", "Training"),
    tr("验证", "Validation"),
    tr("测试", "Test"),
  ];
  runProgress(run, evaluations, checkpoints).forEach((progress, i) => {
    const row = el("div", null, "sidebar-progress-row");
    const track = el("div", null, "sidebar-progress-track");
    const fill = el("span", null, "sidebar-progress-fill");
    track.append(fill);
    if (progress) {
      const value = Math.max(0, Math.min(progress.total, progress.value));
      fill.style.width = (100 * value) / progress.total + "%";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", labels[i]);
      track.setAttribute("aria-valuemax", progress.total);
      track.setAttribute("aria-valuenow", value);
      track.setAttribute(
        "aria-valuetext",
        progress.steps ? progress.steps + " · " + progress.text : progress.text,
      );
    }
    row.append(
      el("span", labels[i]),
      el("span", progress?.text ?? "—", "sidebar-progress-value"),
      track,
    );
    if (progress?.steps)
      row.append(el("span", progress.steps, "sidebar-progress-steps"));
    else if (progress)
      row.title = tr(
        "已完成 / 已登记的 checkpoint 评测项",
        "Completed / registered checkpoint evaluations",
      );
    items.append(row);
  });
  panel.replaceChildren(title, items);
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
    const ordered = [...g.series.values()].sort((a,b) => {
      if ((a.runId === ctx.run.id) !== (b.runId === ctx.run.id))
        return a.runId === ctx.run.id ? -1 : 1;
      return (ctx.versionDates.get(b.versionId) ?? "").localeCompare(ctx.versionDates.get(a.versionId) ?? "") ||
        b.runId.localeCompare(a.runId, undefined, {numeric:true});
    });
    panel.append(curve(ordered,g.name,"",JSON.stringify([namespace,ctx.run.id,id]),tr,zoom));return panel;
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
function sample(groups, name, scope, label, step, value, run, attempt, time) {
  if (!Number.isFinite(value) || !Number.isFinite(step)) return;
  const key = JSON.stringify([scope, name]);
  if (!groups.has(key)) groups.set(key, { name, scope, series: new Map() });
  const seriesId = JSON.stringify([run.id, attempt]);
  const series = groups.get(key).series;
  if (!series.has(seriesId)) series.set(seriesId, { label, runId:run.id, versionId:run.versionId, color: experimentColor(run.versionId || run.id), points: [] });
  const item = series.get(seriesId);
  item.updatedAt = latestMetricTime([item.updatedAt, metricTime(time)]);
  item.points.push([step, value]);
}
export function trainingSeries(samples) {
  const byAttempt = new Map();
  for (const sample of samples) {
    if (!Number.isFinite(sample.step)) continue;
    const attempt = sample.attempt ?? 1;
    if (!byAttempt.has(attempt))
      byAttempt.set(attempt, { firstStep: sample.step, samples: [] });
    const batch = byAttempt.get(attempt);
    batch.firstStep = Math.min(batch.firstStep, sample.step);
    batch.samples.push(sample);
  }

  const series = [];
  for (const [attempt, batch] of [...byAttempt].sort(([a], [b]) => a - b)) {
    const previous = series.at(-1);
    if (!previous || batch.firstStep <= Math.max(1, previous.firstStep)) {
      series.push({ attempt, ...batch });
      continue;
    }
    // This attempt resumed at a higher step. Its samples replace the abandoned
    // suffix of the previous attempt, even for metrics logged at other cadences.
    previous.samples = previous.samples
      .filter((sample) => sample.step < batch.firstStep)
      .concat(batch.samples);
  }
  return series;
}

export function trainingView(ctx) {
  const groups = new Map();
  for (const run of [ctx.run, ...ctx.peers]) {
    const series = trainingSeries(ctx.samples.get(run.id) ?? []);
    for (const entry of series) {
      const label = ctx.runLabel(run) + (series.length > 1 ? " #" + entry.attempt : "");
      for (const m of entry.samples)
        sample(groups, m.name, "", label, m.step, m.value, run, entry.attempt, m.time ?? m.at);
    }
  }
  return panels(groups,ctx);
}
export function evaluationView(ctx) {
  const groups = new Map(),
    runs = new Map([ctx.run, ...ctx.peers].map((r) => [r.id, r]));
  for (const e of ctx.evals) {
    if (
      e.status !== "succeeded" ||
      evaluationSplit(e.dataset, e.split) !== ctx.view
    )
      continue;
    const ck = ctx.weightById.get(e.checkpointId),
      run = runs.get(ck?.runId);
    if (!run) continue;
    const scope = [e.dataset, e.protocolId, ck.weights].join(" / ");
    for (const m of e.finalMetrics)
      sample(groups, m.name, scope, ctx.runLabel(run), ck.step, m.value, run, undefined, m.time ?? m.at ?? e.completedAt);
  }
  const pending = ctx.evals.filter(e =>
    ctx.weightById.get(e.checkpointId)?.runId === ctx.run.id &&
    ["queued","running","partial","failed"].includes(e.status) &&
    evaluationSplit(e.dataset, e.split) === ctx.view);
  const priority = { running: 0, failed: 1, partial: 2, queued: 3 };
  pending.sort((a, b) =>
    priority[a.status] - priority[b.status] ||
    a.dataset.localeCompare(b.dataset) ||
    (ctx.weightById.get(a.checkpointId)?.step ?? 0) - (ctx.weightById.get(b.checkpointId)?.step ?? 0));
  const progress = pending.map(e => {
    const box = el("div",null,"evaluation-progress");
    const step = ctx.weightById.get(e.checkpointId)?.step;
    const done = e.progress?.done ?? e.step ?? 0, total = e.progress?.total;
    box.append(el("span", [e.dataset, step?.toLocaleString("en"), states(e.status, ctx.view),
      Number.isFinite(total) ? done + " / " + total : String(done)].filter(v=>v!=null).join(" · ")));
    if (Number.isFinite(total) && total > 0) {
      const bar = el("progress"); bar.max=total;bar.value=done;
      bar.setAttribute("aria-label",e.dataset);box.append(bar);
    }
    return box;
  });
  return [...progress,...panels(groups,ctx)];
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
