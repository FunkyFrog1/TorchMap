import { routeWire } from "./routing.js";
export const COLORS = {
  gray: "var(--card-gray, #8d989e)",
  blue: "var(--card-blue, #7c97a8)",
  purple: "var(--card-purple, #9b8eaa)",
  cyan: "var(--card-cyan, #7b9fa1)",
  green: "var(--card-green, #8da394)",
  amber: "var(--card-amber, #b2a081)",
  rose: "var(--card-rose, #ae939c)",
  slate: "var(--card-slate, #8a96ad)",
};
export const COLOR_LABELS = {
  gray: "石灰",
  blue: "灰蓝",
  purple: "灰紫",
  cyan: "青灰",
  green: "鼠尾草绿",
  amber: "砂色",
  rose: "藕灰",
  slate: "雾蓝",
};
export const STATUS = {
  recorded: "已记录",
  planned: "计划中",
  running: "进行中",
  complete: "已完成",
  paused: "已暂停",
};
export const RELATIONS = {
  branch: "版本迭代",
  merge: "合并改动",
  finetune: "微调",
};

export function relatives(edges, id, direction = "up") {
  const result = new Set([id]),
    pending = [id];
  while (pending.length) {
    const at = pending.pop();
    for (const edge of edges) {
      const next =
        direction === "up"
          ? edge.to === at
            ? edge.from
            : null
          : edge.from === at
            ? edge.to
            : null;
      if (next && !result.has(next)) {
        result.add(next);
        pending.push(next);
      }
    }
  }
  return result;
}

export function normalizeProject(raw) {
  if (
    !raw ||
    raw.schemaVersion !== 1 ||
    !Array.isArray(raw.nodes) ||
    !Array.isArray(raw.edges)
  )
    throw new Error(
      "请选择 Experiment Map 的 JSON 项目文件（schemaVersion: 1）",
    );
  const nodes = raw.nodes.map((node) => {
    if (!node || !node.id || !String(node.title || "").trim())
      throw new Error("每个版本都需要 ID 和名称");
    const date = String(node.date || "");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw new Error("版本日期应为有效的 YYYY-MM-DD");
    return {
      row: Number.isInteger(node.row) ? node.row : undefined,
      id: String(node.id),
      title: String(node.title).trim(),
      ...(typeof node.creator === "string" && node.creator.trim() ? { creator: node.creator.trim() } : {}),
      date,
      accent: Object.hasOwn(COLORS, node.accent) ? node.accent : "blue",
      status: Object.hasOwn(STATUS, node.status) ? node.status : "recorded",
      summary: String(node.summary || ""),
      configuration: String(node.configuration || ""),
      initialization: String(node.initialization || ""),
      notes: String(node.notes || ""),
      ...(node.changeDetails ? {changeDetails: String(node.changeDetails)} : {}),
      changes: Array.isArray(node.changes) ? node.changes.map(String) : [],
      metrics: Array.isArray(node.metrics)
        ? node.metrics.map((m) => ({
            name: String(m.name),
            value: String(m.value),
          }))
        : [],
      links: Array.isArray(node.links)
        ? node.links.map((l) => ({
            label: String(l.label),
            url: String(l.url),
          }))
        : [],
    };
  });
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) throw new Error("版本 ID 不能重复");
  const pairs = new Set();
  const edges = raw.edges.map((edge) => {
    if (!edge || !ids.has(edge.from) || !ids.has(edge.to))
      throw new Error("连线引用了不存在的版本");
    const key = edge.from + "\0" + edge.to;
    if (pairs.has(key)) throw new Error("同一对版本不能重复连线");
    pairs.add(key);
    return {
      from: edge.from,
      to: edge.to,
      kind: Object.hasOwn(RELATIONS, edge.kind) ? edge.kind : "branch",
      label: String(edge.label || ""),
    };
  });
  // A lineage graph must not let an experiment become its own ancestor.
  const indegree = new Map(nodes.map((n) => [n.id, 0])),
    children = new Map(nodes.map((n) => [n.id, []]));
  for (const edge of edges) {
    indegree.set(edge.to, indegree.get(edge.to) + 1);
    children.get(edge.from).push(edge.to);
  }
  const pending = [...ids].filter((id) => !indegree.get(id));
  let visited = 0;
  while (pending.length) {
    const id = pending.pop();
    visited++;
    for (const next of children.get(id)) {
      indegree.set(next, indegree.get(next) - 1);
      if (!indegree.get(next)) pending.push(next);
    }
  }
  if (visited !== nodes.length)
    throw new Error("上游关系形成了循环，请检查连线");
  return {
    schemaVersion: 1,
    updatedAt: String(raw.updatedAt || ""),
    title: String(raw.title || "未命名项目"),
    description: String(raw.description || ""),
    nodes,
    edges,
  };
}

export function layoutProject(project,mode="date",savedRows={}) {
  const nodeWidth=250,nodeHeight=132;
  const ancestors=new Map(project.nodes.map(n=>[n.id,[]])),depth=new Map();
  for(const edge of project.edges)ancestors.get(edge.to).push(edge.from);
  function generation(id){
    if(!depth.has(id))depth.set(id,1+Math.max(0,...ancestors.get(id).map(generation)));
    return depth.get(id);
  }
  const group=n=>mode==="generation"?generation(n.id):n.date;
  const dates=[...new Set(project.nodes.map(group))].sort(mode==="generation"?(a,b)=>a-b:undefined);
  const columns=dates.map((key,i)=>{const members=project.nodes.filter(n=>group(n)===key);
    return {key,date:members.map(n=>n.date).sort().at(-1),x:40+i*340,count:members.length};});
  const tallest=Math.max(1,...columns.map(c=>c.count));
  const rowPitch = mode === "generation" ? nodeHeight + 20 : 204;
  for (const c of columns) {
    c.rowTop = 146 + (tallest - c.count) * rowPitch / 2;
    // Row zero is the centered starting lane. The column heading is the actual upper boundary.
    c.minRow = Math.ceil((70 - c.rowTop) / rowPitch);
  }
  const positions = new Map();
  const occupied = new Map(dates.map((date) => [date, new Set()]));
  const columnByDate = new Map(columns.map((column) => [column.key, column]));
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const parents = new Map(project.nodes.map((node) => [node.id, []]));
  const children = new Map(project.nodes.map((node) => [node.id, []]));
  for (const edge of project.edges) {
    parents.get(edge.to).push(edge);
    children.get(edge.from).push(edge.to);
  }
  let maximumRow = 0;

  function place(node, preferred, minimum = 0) {
    const used = occupied.get(group(node));
    preferred = Math.max(preferred, minimum);
    let row = preferred;
    // Keep continuations near their upstream lane, using the next lower lane
    // first when both sides are equally close.
    for (let distance = 0; used.has(row); distance++) {
      const below = preferred + distance + 1;
      const above = preferred - distance - 1;
      row = !used.has(below)
        ? below
        : above >= minimum && !used.has(above)
          ? above
          : row;
    }
    used.add(row);
    maximumRow = Math.max(maximumRow, row);
    positions.set(node.id, {
      ...node,
      row,
      x: columnByDate.get(group(node)).x,
      minRow:columnByDate.get(group(node)).minRow, group:group(node), rowTop:columnByDate.get(group(node)).rowTop, y: columnByDate.get(group(node)).rowTop + row * rowPitch,
    });
  }

  // Saved lanes are the source of truth, as in the original date-column map.
  // Reserve them before placing new cards so adding a branch cannot push them.
  for (const column of columns) {
    for (const node of project.nodes.map(n=>mode==="generation"?{...n,row:savedRows[n.id]}:n)
      .filter(
        (n) => group(n) === column.key && Number.isInteger(n.row),
      )
      .sort((a, b) => a.row - b.row)) {
      const used = occupied.get(group(node));
      let row = Math.max(column.minRow, node.row);
      while (used.has(row)) row++;
      place(node, row, column.minRow);
    }
  }

  // Process upstream cards first, even when an imported file lists children first.
  const remaining = new Map(
    project.nodes.map((node) => [node.id, parents.get(node.id).length]),
  );
  const pending = project.nodes
    .filter((node) => !remaining.get(node.id))
    .map((node) => node.id);
  for (let index = 0; index < pending.length; index++) {
    const id = pending[index];
    const node = nodes.get(id);
    if (!positions.has(id)) {
      const incoming = parents.get(id);
      const lineage = incoming.filter(
        (edge) => edge.kind === "branch" || edge.kind === "finetune",
      );
      const upstream = (lineage.length ? lineage : incoming).map((edge) =>
        positions.get(edge.from),
      );
      const sameDay = upstream.filter((parent) => group(parent) === group(node));
      const minimum = sameDay.length
        ? Math.max(...sameDay.map((parent) => parent.row)) + 1
        : 0;
      place(node, mode === "generation" ? 0 : upstream[0]?.row ?? 0, minimum);
    }
    for (const child of children.get(id)) {
      remaining.set(child, remaining.get(child) - 1);
      if (!remaining.get(child)) pending.push(child);
    }
  }
  return {
    nodes: project.nodes.map((n) => positions.get(n.id)),
    columns,
    rowPitch,
    nodeWidth,
    nodeHeight,
    width: Math.max(600, columns.length * 340 - 10 + 80),
    height: Math.max(480,...[...positions.values()].map(n=>n.y+nodeHeight+90)),
  };
}

export function wirePath(edge, layout, edges) {
  return routeWire(edge, layout, edges);
}

export function safeLink(url) {
  try {
    const value = new URL(url);
    return ["http:", "https:"].includes(value.protocol) ? value.href : null;
  } catch {
    return null;
  }
}
