import { language } from "./i18n.js";
import { curve } from "./monitor-chart.js";
export const tr = (zh, en) => (language() === "en" ? en : zh);
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
  const pinKey="tm-project-pins:"+project;
  let pins=new Set();
  try {
    const saved=localStorage.getItem(pinKey);
    if(saved!==null)pins=new Set(JSON.parse(saved));
    else {
      for(const view of ["training","validation","test"]){
        const oldKey="tm-pins:"+JSON.stringify([project,view]);
        for(const id of JSON.parse(localStorage.getItem(oldKey)||"[]")){
          const [,name]=JSON.parse(id);pins.add(name);
        }
      }
      localStorage.setItem(pinKey,JSON.stringify([...pins]));
    }
  }catch{}
  const host=el("div",null,"metric-browser");
  function card(id,g){
    const panel=el("section",null,"monitor-panel metric-card");
    const heading=el("div",null,"metric-heading"),pin=el("button",null,"metric-pin");
    const marked=pins.has(g.name);pin.type="button";pin.setAttribute("aria-pressed",String(marked));
    pin.title=marked?tr("取消固定","Unpin"):tr("固定到顶部","Pin to top");pin.setAttribute("aria-label",pin.title+" · "+g.name);
    pin.innerHTML=pinIcon;
    pin.onclick=()=>{if(marked)pins.delete(g.name);else pins.add(g.name);localStorage.setItem(pinKey,JSON.stringify([...pins]));render();};
    const tools=el("div",null,"metric-tools"),zoom=el("div",null,"chart-actions");tools.append(zoom,pin);heading.append(el("h2",g.name),tools);panel.append(heading);
    if(g.scope)panel.append(el("small",g.scope,"monitor-muted"));
    panel.append(curve([...g.series.values()],tr("训练步","Training step"),"",JSON.stringify([namespace,ctx.run.id,id]),tr,zoom));return panel;
  }
  function render(){
    const top=el("section",null,"pin-section"),fixed=el("div",null,"scalar-grid");
    const title=el("h2",null,"pinned-symbol");title.innerHTML=pinIcon;title.setAttribute("aria-label",tr("已固定指标","Pinned metrics"));title.title=tr("已固定指标","Pinned metrics");top.append(title,fixed);
    for(const name of pins)for(const [id,g] of groups)if(g.name===name && g.current)fixed.append(card(id,g));
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
function sample(groups, name, scope, label, step, value, current) {
  if (!Number.isFinite(value) || !Number.isFinite(step)) return;
  const key = JSON.stringify([scope, name]);
  if (!groups.has(key)) groups.set(key, { name, scope, series: new Map() });
  if(current)groups.get(key).current=true;
  const series = groups.get(key).series;
  if (!series.has(label)) series.set(label, { label, points: [] });
  series.get(label).points.push([step, value]);
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
        m.value,run.id===ctx.run.id,
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
      sample(groups, m.name, scope, ctx.runLabel(run), ck.step, m.value, run.id===ctx.run.id);
  }
  return panels(groups,ctx);
}
