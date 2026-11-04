import { t, language, setLanguage } from "./i18n.js";
import {
  COLORS,
  COLOR_LABELS,
  RELATIONS,
  relatives,
  safeLink,
} from "../core/graph.js";

const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};

export class NodeEditor {
  constructor(onSave) {
    this.dialog = document.querySelector("#node-dialog");
    this.form = document.querySelector("#node-form");
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        const value = new FormData(this.form),
          text = (name) => String(value.get(name) || "").trim();
        const lines = (name) =>
          text(name)
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
        const metrics = lines("metrics").map((line) => {
          const split = line.indexOf("=");
          if (split < 1)
            throw new Error(t("指标请按“名称 = 数值”填写，每行一条"));
          return {
            name: line.slice(0, split).trim(),
            value: line.slice(split + 1).trim(),
          };
        });
        const links = lines("links").map((line) => {
          const split = line.indexOf("|");
          if (split < 1 || !safeLink(line.slice(split + 1).trim()))
            throw new Error(t("链接请按“名称 | http(s)网址”填写"));
          return {
            label: line.slice(0, split).trim(),
            url: line.slice(split + 1).trim(),
          };
        });
        const parents = [
          ...document.querySelectorAll("#parent-options input:checked"),
        ].map((input) => ({
          from: input.value,
          kind: input.closest(".parent-option").querySelector("select").value,
        }));
        onSave(
          {
            ...(this.node || { row: this.draft.row }),
            id: this.node?.id || crypto.randomUUID(),
            title: text("title"),
            date: text("date"),
            status: text("status"),
            summary: text("summary"),
            accent: text("accent"),
            changes: lines("changes"),
            configuration: text("configuration"),
            initialization: text("initialization"),
            notes: text("notes"),
            metrics,
            links,
          },
          parents,
        );
        this.dialog.close();
      } catch (error) {
        document.querySelector("#node-form-error").textContent = t(
          error.message,
        );
      }
    });
  }

  open(project, node = null, draft = {}) {
    this.draft = draft;
    this.node = node;
    this.form.reset();
    document.querySelector("#node-form-error").textContent = "";
    document.querySelector("#node-dialog-title").textContent = node
      ? t("编辑版本")
      : t("新增版本");
    const defaults = {
      title: "",
      date: new Date().toLocaleDateString("sv-SE"),
      status: "recorded",
      summary: "",
      configuration: "",
      initialization: "",
      notes: "",
      ...draft,
      ...node,
    };
    for (const name of [
      "title",
      "date",
      "status",
      "summary",
      "configuration",
      "initialization",
      "notes",
    ])
      this.form.elements.namedItem(name).value = defaults[name];
    this.form.elements.changes.value = (node?.changes || []).join("\n");
    this.form.elements.metrics.value = (node?.metrics || [])
      .map((m) => m.name + " = " + m.value)
      .join("\n");
    this.form.elements.links.value = (node?.links || [])
      .map((l) => l.label + " | " + l.url)
      .join("\n");
    const palette = document.querySelector("#color-options");
    palette.replaceChildren();
    for (const [key, color] of Object.entries(COLORS)) {
      const label = element("label", undefined, "color-choice");
      label.title = t(COLOR_LABELS[key]);
      const input = element("input");
      input.type = "radio";
      input.name = "accent";
      input.value = key;
      input.checked = (node?.accent || draft.accent || "blue") === key;
      input.setAttribute("aria-label", t(COLOR_LABELS[key]));
      const chip = element("span");
      chip.style.background = color;
      label.append(input, chip);
      palette.append(label);
    }
    const parentOptions = document.querySelector("#parent-options");
    parentOptions.replaceChildren();
    const excluded = node
      ? relatives(project.edges, node.id, "down")
      : new Set();
    const choices = project.nodes.filter((n) => !excluded.has(n.id));
    if (!choices.length)
      parentOptions.append(
        element("p", t("暂无可选上游；这个版本将作为独立起点。"), "subtle"),
      );
    for (const parent of choices) {
      const existing =
        project.edges.find((e) => e.to === node?.id && e.from === parent.id) ||
        draft.parents?.find((item) => item.from === parent.id);
      const row = element("div", undefined, "parent-option"),
        label = element("label"),
        input = element("input");
      input.type = "checkbox";
      input.value = parent.id;
      input.checked = Boolean(existing);
      label.append(
        input,
        element("span", parent.title),
        element("small", parent.date),
      );
      const select = element("select");
      select.setAttribute("aria-label", parent.title + t("的关系类型"));
      for (const [kind, title] of Object.entries(RELATIONS)) {
        const option = element("option", t(title));
        option.value = kind;
        select.append(option);
      }
      select.value = existing?.kind || "branch";
      select.disabled = !input.checked;
      input.addEventListener(
        "change",
        () => (select.disabled = !input.checked),
      );
      row.append(label, select);
      parentOptions.append(row);
    }
    this.dialog.showModal();
    this.form.elements.title.focus();
  }
}
