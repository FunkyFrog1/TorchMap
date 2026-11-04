import "./interface.js";
import "./themes.js";
import { t, language, setLanguage } from "./i18n.js";
import { MapCanvas } from "./canvas.js";
import { NodeEditor } from "./editor.js";
import {
  normalizeProject,
  layoutProject,
  STATUS,
  RELATIONS,
  safeLink,
} from "../core/graph.js";
import {
  loadProject,
  saveProject,
  downloadProject,
  projectId,
} from "./storage.js";

const $ = (id) => document.getElementById(id);
const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const button = (text, action, className = "") => {
  const node = element("button", text, className);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
};
let leavingProject = false;
let project,
  selected = null,
  toastTimer,
  projectMode = "edit",
  confirmAction;
const undoStack = [],
  redoStack = [];
const canvas = new MapCanvas(select, (id, row) => {
  const next = structuredClone(project);
  const positions = new Map(
    canvas.layout.nodes.map((node) => [node.id, node.row]),
  );
  const moving = next.nodes.find((node) => node.id === id);
  const previous = positions.get(id);
  for (const node of next.nodes) {
    node.row = positions.get(node.id);
    if (node.id !== id && node.date === moving.date && node.row === row)
      node.row = previous;
  }
  moving.row = row;
  commit(next, id);
});
canvas.onCreate = (source, draft) => {
  if (leavingProject) return;
  editor.open(project, null, {
    ...draft,
    accent: source.accent,
    parents: [{ from: source.id, kind: "branch" }],
  });
};
const editor = new NodeEditor((node, parents) => {
  const next = structuredClone(project),
    index = next.nodes.findIndex((n) => n.id === node.id);
  if (index >= 0) {
    const occupied = new Set(
      canvas.layout.nodes
        .filter((item) => item.id !== node.id && item.date === node.date)
        .map((item) => item.row),
    );
    node.row = canvas.layout.nodes.find((item) => item.id === node.id).row;
    while (occupied.has(node.row)) node.row++;
    next.nodes[index] = node;
  } else next.nodes.push(node);
  const previous = new Map(
    next.edges.filter((e) => e.to === node.id).map((e) => [e.from, e]),
  );
  next.edges = next.edges.filter((e) => e.to !== node.id);
  next.edges.push(
    ...parents.map((p) => ({
      from: p.from,
      to: node.id,
      kind: p.kind,
      label: previous.get(p.from)?.label || "",
    })),
  );
  // Save the displayed lanes with the edit, keeping them stable on reload and
  // future additions. A date change keeps the card's lane when it is available.
  const rows = new Map(
    layoutProject(next).nodes.map((item) => [item.id, item.row]),
  );
  for (const item of next.nodes) item.row = rows.get(item.id);
  commit(next, node.id);
  canvas.focus(node.id);
});

function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4500);
}
function saveState(state, detail) {
  const target = $("save-state");
  target.dataset.state = state;
  target.textContent =
    state === "saving"
      ? t("正在保存…")
      : state === "error"
        ? t("保存未完成 · Ctrl+S重试")
        : t("已保存到本机");
  target.title = detail || "";
  target.dataset.detail = detail || "";
  if (state === "error") toast(t("保存暂未完成，请用 Ctrl+S 重试：") + detail);
}
async function persist() {
  const saved = await saveProject(project, saveState);
  if (saved) void refreshProjects().catch(() => {});
  return saved;
}
function commit(next, nextSelected = selected) {
  if (leavingProject) return;
  const clean = normalizeProject(next);
  undoStack.push({ project: structuredClone(project), selected });
  if (undoStack.length > 40) undoStack.shift();
  redoStack.length = 0;
  project = clean;
  project.updatedAt = new Date().toISOString();
  selected = nextSelected;
  if (!project.nodes.some((n) => n.id === selected)) selected = null;
  render();
  persist();
}
function restore(source, destination) {
  if (!source.length) return;
  destination.push({ project: structuredClone(project), selected });
  const snapshot = source.pop();
  project = snapshot.project;
  selected = snapshot.selected;
  render({ fit: true });
  persist();
}
function select(id) {
  selected = id;
  canvas.select(id);
  details();
  history.replaceState(
    null,
    "",
    id ? "#" + encodeURIComponent(id) : location.pathname + location.search,
  );
}
function render(options = {}) {
  const current = [...$("project-picker").options].find(
    (option) => option.value === projectId,
  );
  if (current) current.textContent = project.title;
  document.title = project.title + " · Experiment Map";
  $("project-counts").textContent = t("项目计数", {
    nodes: project.nodes.length,
    edges: project.edges.length,
    dates: new Set(project.nodes.map((n) => n.date)).size,
  });
  $("undo").disabled = !undoStack.length;
  $("redo").disabled = !redoStack.length;
  canvas.render(project, selected, options);
  details();
  history.replaceState(
    null,
    "",
    selected
      ? "#" + encodeURIComponent(selected)
      : location.pathname + location.search,
  );
}
function section(title, collapsed = false) {
  const block = element(
    collapsed ? "details" : "section",
    undefined,
    "detail-section",
  );
  block.append(element(collapsed ? "summary" : "h3", title));
  return block;
}
function details() {
  const target = $("inspector");
  target.replaceChildren();
  const node = project.nodes.find((n) => n.id === selected);
  if (!node) {
    target.append(
      element("p", "EXPERIMENT MAP", "eyebrow"),

      element(
        "p",
        project.description || t("在同一张图中记录版本关系、改动与结论。"),
        "project-description",
      ),
    );
    target.append(
      button(t("＋ 新增版本"), () => editor.open(project), "primary wide"),
    );
    const local = section(t("本地项目"));
    local.append(
      element(
        "p",
        t(
          "项目保存在本机 data/project.json。示例均为虚构，可自由编辑或新建项目。",
        ),
        "subtle",
      ),
    );
    target.append(local);
    return;
  }
  const top = element("div", undefined, "inspector-top");
  top.append(
    element("span", node.date, "eyebrow"),
    button(t("全部路线"), () => select(null), "text-button"),
  );
  target.append(top, element("h1", node.title));
  const badge = element("span", t(STATUS[node.status]), "status-badge");
  badge.dataset.status = node.status;
  target.append(badge);
  if (node.summary)
    target.append(element("p", node.summary, "project-description"));
  const actions = element("div", undefined, "detail-actions");
  actions.append(
    button(t("编辑版本"), () => editor.open(project, node), "primary"),
    button(
      t("删除"),
      () =>
        ask(t("删除版本"), t("删除说明", { title: node.title }), () => {
          const next = structuredClone(project);
          next.nodes = next.nodes.filter((n) => n.id !== node.id);
          next.edges = next.edges.filter(
            (e) => e.from !== node.id && e.to !== node.id,
          );
          commit(next, null);
          toast(t("已删除，可点击撤销恢复"));
        }),
      "danger-link",
    ),
  );
  target.append(actions);
  if (node.changes.length) {
    const block = section(t("主要改动")),
      list = element("ul");
    node.changes.forEach((change) => list.append(element("li", change)));
    block.append(list);
    target.append(block);
  }
  if (node.configuration) {
    const block = section(t("配置说明"), true);
    block.append(element("p", node.configuration, "preserve-lines"));
    target.append(block);
  }
  if (node.initialization) {
    const block = section(t("初始化来源"), true);
    block.append(element("p", node.initialization, "preserve-lines"));
    target.append(block);
  }
  const upstream = project.edges.filter((e) => e.to === node.id);
  const parents = section(t("直接上游"), true);
  if (!upstream.length) parents.append(element("p", t("独立起点"), "subtle"));
  for (const edge of upstream) {
    const parent = project.nodes.find((n) => n.id === edge.from),
      row = element("div", undefined, "parent-link");
    row.append(
      button(
        parent.title,
        () => {
          select(parent.id);
          canvas.focus(parent.id);
        },
        "text-button",
      ),
      element("small", t(RELATIONS[edge.kind])),
    );
    parents.append(row);
  }
  target.append(parents);
  if (node.metrics.length) {
    const block = section(t("记录指标")),
      table = element("dl", undefined, "metrics");
    for (const metric of node.metrics)
      table.append(element("dt", metric.name), element("dd", metric.value));
    block.append(table);
    target.append(block);
  }
  if (node.links.length) {
    const block = section(t("相关链接"));
    for (const link of node.links) {
      const href = safeLink(link.url);
      if (!href) continue;
      const a = element("a", link.label + " ↗", "external-link");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      block.append(a);
    }
    target.append(block);
  }
  if (node.notes) {
    const block = section(t("备注"));
    block.append(element("p", node.notes, "preserve-lines"));
    target.append(block);
  }
  const blocks = [...target.querySelectorAll(":scope > .detail-section")];
  const priority = [t("主要改动"), t("记录指标"), t("备注")];
  for (const title of priority) {
    const block = blocks.find(
      (item) => item.firstElementChild.textContent === title,
    );
    if (block) target.append(block);
  }
  for (const block of blocks)
    if (!priority.includes(block.firstElementChild.textContent))
      target.append(block);
}
function ask(title, message, action) {
  confirmAction = action;
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  $("confirm-dialog").showModal();
}
$("confirm-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("confirm-dialog").close();
  const action = confirmAction;
  confirmAction = null;
  try {
    await action?.();
  } catch (error) {
    toast(t("保存失败") + ": " + error.message);
  }
});
for (const close of document.querySelectorAll(".close-dialog"))
  close.addEventListener("click", () => close.closest("dialog").close());
$("search").addEventListener("input", (event) =>
  canvas.search(event.target.value),
);
$("undo").addEventListener("click", () => restore(undoStack, redoStack));
$("redo").addEventListener("click", () => restore(redoStack, undoStack));
for (const id of ["add-node", "empty-add"])
  $(id).addEventListener("click", () => {
    if (project) editor.open(project);
  });
$("export-project").addEventListener("click", () => {
  if (project) {
    downloadProject(project);
    toast(t("已导出JSON项目文件"));
  }
});
$("import-project").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const next = normalizeProject(JSON.parse(await file.text()));
    commit(next, null);
    canvas.fit();
    toast(t("导入完成", { n: next.nodes.length }));
  } catch (error) {
    toast(t("导入失败：") + t(error.message));
  }
  event.target.value = "";
});
function openProject(mode) {
  if (!project) return;
  projectMode = mode;
  $("project-dialog-title").textContent =
    mode === "new" ? t("新建项目") : t("项目设置");
  const form = $("project-form");
  form.elements.title.value = mode === "new" ? t("未命名项目") : project.title;
  form.elements.description.value = mode === "new" ? "" : project.description;
  $("project-dialog").showModal();
  form.elements.title.focus();
}
$("new-project").addEventListener("click", () => openProject("new"));
$("project-settings").addEventListener("click", () => openProject("edit"));
$("project-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(event.target);
  const next =
    projectMode === "new"
      ? { schemaVersion: 1, nodes: [], edges: [] }
      : structuredClone(project);
  next.title = String(values.get("title")).trim();
  next.description = String(values.get("description")).trim();
  if (projectMode === "new") {
    await leaveProject(async () => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error(t("保存失败"));
      return (await response.json()).id;
    });
    return;
  }
  commit(next, selected);
  $("project-dialog").close();
});
window.addEventListener("keydown", (event) => {
  if (leavingProject) return;
  if (
    !(event.ctrlKey || event.metaKey) ||
    event.target.closest("input,textarea,select,[contenteditable]")
  )
    return;
  const key = event.key.toLowerCase();
  if (key === "s") {
    event.preventDefault();
    if (project) persist();
  }
  if (document.querySelector("dialog[open]")) return;
  if (key === "z") {
    event.preventDefault();
    restore(
      event.shiftKey ? redoStack : undoStack,
      event.shiftKey ? undoStack : redoStack,
    );
  }
  if (key === "y") {
    event.preventDefault();
    restore(redoStack, undoStack);
  }
});

let projectListRevision = 0;
async function refreshProjects() {
  const revision = ++projectListRevision;
  const response = await fetch("/api/projects");
  if (!response.ok) return;
  const projects = await response.json();
  if (revision !== projectListRevision) return;
  const picker = $("project-picker");
  picker.replaceChildren();
  for (const item of projects) {
    const option = element("option", item.title);
    option.value = item.id;
    picker.append(option);
  }
  picker.value = projectId;
  $("archive-project").hidden = projectId === "default";
}
function projectBusy(busy) {
  if (busy) canvas.cancelBranchDrag?.();
  leavingProject = busy;
  document.querySelector(".app-header").inert = busy;
  document.querySelector(".workspace").inert = busy;
  document.querySelector(".project-sidebar").inert = busy;
  $("project-form").inert = busy;
}
// Freeze edits until the final queued save completes, so navigation cannot
// discard a newer drag or rename submitted while a slow save is in flight.
async function leaveProject(destination) {
  if (leavingProject) return;
  projectBusy(true);
  try {
    if (project && !(await persist())) {
      projectBusy(false);
      $("project-picker").value = projectId;
      return;
    }
    const id = await destination();
    location.href =
      id === "default" ? "/" : "?project=" + encodeURIComponent(id);
  } catch (error) {
    projectBusy(false);
    $("project-picker").value = projectId;
    toast(t("保存失败") + ": " + error.message);
  }
}
$("project-picker").addEventListener("change", (event) => {
  const id = event.target.value;
  leaveProject(async () => id);
});
$("archive-project").addEventListener("click", () =>
  ask(t("归档项目"), t("归档说明"), () =>
    leaveProject(async () => {
      const response = await fetch("/api/projects?project=" + projectId, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(t("保存失败"));
      return "default";
    }),
  ),
);

try {
  void refreshProjects().catch(() => {});
  const result = await loadProject();
  project = result.project;
  const hash = decodeURIComponent(location.hash.slice(1));
  selected = project.nodes.some((n) => n.id === hash) ? hash : null;
  render({ fit: true });
  saveState("saved");
  if (result.recovered) {
    toast(t("已恢复尚未写入文件的本机草稿"));
    persist();
  }
} catch (error) {
  $("save-state").textContent = t("读取失败");
  $("inspector").append(
    element("h1", t("暂时无法打开项目")),
    element("p", t(error.message)),
  );
  toast(t(error.message));
}

function languageButton() {
  $("language").textContent = language() === "en" ? "EN" : "中文";
  $("language").title =
    language() === "en" ? "切换为中文" : "Switch to English";
}
languageButton();
$("language").addEventListener("click", () => {
  setLanguage(language() === "en" ? "zh-CN" : "en");
  languageButton();
  if (project) render();
  const state = $("save-state");
  saveState(state.dataset.state || "saved", state.dataset.detail);
});
