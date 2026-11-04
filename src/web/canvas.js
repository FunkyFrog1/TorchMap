import { t, language, setLanguage } from "./i18n.js";
import {
  COLORS,
  STATUS,
  RELATIONS,
  layoutProject,
  relatives,
  wirePath,
} from "../core/graph.js";

const NS = "http://www.w3.org/2000/svg";
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svg = (tag, attributes) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes))
    node.setAttribute(key, value);
  return node;
};

export class MapCanvas {
  constructor(onSelect, onMove) {
    this.onSelect = onSelect;
    this.onMove = onMove;
    this.cards = new Map();
    this.paths = [];
    this.viewport = document.querySelector("#viewport");
    this.world = document.querySelector("#world");
    this.wires = document.querySelector("#wires");
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.fitted = false;
    this.query = "";
    this.viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      this.drag = {
        x: event.clientX,
        y: event.clientY,
        panX: this.panX,
        panY: this.panY,
        moved: false,
      };
      this.viewport.setPointerCapture(event.pointerId);
      this.viewport.classList.add("is-panning");
    });
    this.viewport.addEventListener("pointermove", (event) => {
      if (!this.drag) return;
      if (
        Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y) > 4
      )
        this.drag.moved = true;
      this.panX = this.drag.panX + event.clientX - this.drag.x;
      this.panY = this.drag.panY + event.clientY - this.drag.y;
      this.applyCamera();
    });
    const stop = (event) => {
      const blankClick =
        event.type === "pointerup" && this.drag && !this.drag.moved;
      this.drag = null;
      this.viewport.classList.remove("is-panning");
      if (blankClick) this.onSelect(null);
    };
    this.viewport.addEventListener("pointerup", stop);
    this.viewport.addEventListener("pointercancel", stop);
    this.viewport.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const rect = this.viewport.getBoundingClientRect();
        this.zoom(
          this.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12),
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      },
      { passive: false },
    );
    document.querySelector("#fit").addEventListener("click", () => this.fit());
    document
      .querySelector("#focus")
      .addEventListener("click", () => this.focus(this.selected));
    new ResizeObserver(() => {
      if (this.layout) {
        if (!this.fitted) this.fit();
        else this.applyCamera();
      }
    }).observe(this.viewport);
  }

  render(project, selected, { fit = false } = {}) {
    this.cancelBranchDrag?.();
    this.project = project;
    this.selected = selected;
    this.layout = layoutProject(project);
    const layout = this.layout;
    this.cards.clear();
    this.paths = [];
    this.world
      .querySelectorAll(".experiment-node,.date-column,.branch-handle")
      .forEach((n) => n.remove());
    this.wires.replaceChildren();
    Object.assign(this.world.style, {
      width: layout.width + "px",
      height: layout.height + "px",
    });
    this.wires.style.width = layout.width + "px";
    this.wires.style.height = layout.height + "px";
    this.wires.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    for (const column of layout.columns) {
      const band = element("div", "date-column");
      band.style.left = column.x - 14 + "px";
      band.style.height = layout.height - 24 + "px";
      band.dataset.date = column.date;
      const heading = element("div", "date-heading");
      heading.append(
        element(
          "strong",
          "",
          new Intl.DateTimeFormat(language(), {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }).format(new Date(column.date)),
        ),
        element(
          "span",
          "",
          column.date.slice(0, 4) + " · " + t("数量版本", { n: column.count }),
        ),
      );
      band.append(heading);
      this.world.insertBefore(band, this.wires);
    }
    const positions = new Map(layout.nodes.map((n) => [n.id, n]));
    for (const edge of project.edges) {
      const d = wirePath(edge, layout, project.edges),
        color = COLORS[positions.get(edge.to).accent];
      const path = svg("path", { d, class: "wire " + edge.kind });
      path.style.setProperty("--accent", color);
      path.dataset.from = edge.from;
      path.dataset.to = edge.to;
      const title = svg("title", {});
      title.textContent = edge.label || t(RELATIONS[edge.kind]);
      path.append(title);
      this.wires.append(path);
      this.paths.push({ edge, path });
    }
    for (const node of layout.nodes) {
      const card = element("button", "experiment-node");
      card.type = "button";
      card.dataset.id = node.id;
      card.style.setProperty("--accent", COLORS[node.accent]);
      card.style.left = node.x + "px";
      card.style.top = node.y + "px";
      const parents = project.edges.filter((e) => e.to === node.id).length;
      card.classList.toggle("is-root", parents === 0);
      card.setAttribute("aria-label", node.title + " · " + t("查看版本详情"));
      const header = element("span", "node-header");
      header.append(element("strong", "node-title", node.title));
      const body = element("span", "node-body");
      body.append(
        element(
          "span",
          "node-change",
          node.changes[0] || node.configuration || t("点击填写版本改动"),
        ),
      );
      const footer = element("span", "node-footer"),
        status = element("span", "node-status", t(STATUS[node.status]));
      status.dataset.status = node.status;
      footer.append(status);
      body.append(footer);
      card.append(header, body);
      let drag = null,
        suppressClick = false;
      card.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        drag = { start: event.clientY, row: node.row, y: node.y, moved: false };
        card.setPointerCapture(event.pointerId);
      });
      card.addEventListener("pointermove", (event) => {
        if (!drag) return;
        const delta = (event.clientY - drag.start) / this.scale;
        if (Math.abs(delta) > 5) drag.moved = true;
        if (drag.moved) {
          const row = Math.max(0, node.row + Math.round(delta / 204));
          if (row !== drag.row) {
            drag.row = row;
            this.previewPosition(node, 96 + row * 204);
          }
          card.classList.add("is-dragging");
        }
      });
      card.addEventListener("pointerup", (event) => {
        if (!drag) return;
        event.stopPropagation();
        const finished = drag;
        drag = null;
        card.classList.remove("is-dragging");
        suppressClick = finished.moved;
        if (finished.moved && finished.row !== node.row)
          this.onMove(node.id, finished.row);
        else this.previewPosition(node, finished.y);
      });
      card.addEventListener("pointercancel", () => {
        if (drag) this.previewPosition(node, drag.y);
        drag = null;
        card.classList.remove("is-dragging");
      });
      card.addEventListener("click", () => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        this.onSelect(node.id);
      });
      card.addEventListener("dblclick", () => this.focus(node.id));
      this.world.append(card);
      const handle = this.branchHandle(node);
      this.world.append(handle);
      this.cards.set(node.id, { card, handle });
    }
    document.querySelector("#empty-map").hidden = project.nodes.length > 0;
    this.highlight();
    if (fit || !this.fitted) this.fit();
    else this.applyCamera();
  }

  branchHandle(node) {
    const handle = element("button", "branch-handle");
    handle.type = "button";
    handle.dataset.parent = node.id;
    handle.title = t("拖出新版本");
    handle.setAttribute("aria-label", t("拖出新版本") + " · " + node.title);
    handle.style.left = node.x + this.layout.nodeWidth + "px";
    handle.style.top = node.y + this.layout.nodeHeight / 2 + "px";
    handle.style.setProperty("--accent", COLORS[node.accent]);
    let gesture = null;
    const targetAt = (event) => {
      const rect = this.viewport.getBoundingClientRect();
      const x = (event.clientX - rect.left - this.panX) / this.scale;
      const y = (event.clientY - rect.top - this.panY) / this.scale;
      const index = Math.round((x - 40 - this.layout.nodeWidth / 2) / 340);
      const columns = this.layout.columns;
      const nearest = Math.max(0, Math.min(columns.length - 1, index));
      const date = new Date(columns[nearest].date + "T00:00:00Z");
      date.setUTCDate(date.getUTCDate() + index - nearest);
      return {
        date: date.toISOString().slice(0, 10),
        row: Math.max(0, Math.round((y - 96) / 204)),
        x,
        y,
        inside:
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom,
      };
    };
    const clear = () => {
      cancelAnimationFrame(gesture?.frame);
      window.removeEventListener("blur", clear);
      if (this.cancelBranchDrag === clear) this.cancelBranchDrag = null;
      gesture?.path.remove();
      gesture?.label.remove();
      gesture = null;
      handle.classList.remove("is-connecting");
    };
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      handle.focus({ preventScroll: true });
      const path = svg("path", { class: "branch-preview" });
      const label = element("div", "branch-date");
      this.wires.append(path);
      this.viewport.append(label);
      gesture = {
        path,
        label,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        pointer: { clientX: event.clientX, clientY: event.clientY },
        time: performance.now(),
      };
      this.cancelBranchDrag = clear;
      window.addEventListener("blur", clear);
      gesture.frame = requestAnimationFrame(autoPan);
      handle.classList.add("is-connecting");
      handle.setPointerCapture(event.pointerId);
    });
    const drawPreview = (event) => {
      const target = targetAt(event);
      const sx = node.x + this.layout.nodeWidth,
        sy = node.y + this.layout.nodeHeight / 2;
      const bend = Math.max(35, Math.abs(target.x - sx) * 0.45);
      gesture.path.setAttribute(
        "d",
        `M${sx},${sy} C${sx + bend},${sy} ${target.x - bend},${target.y} ${target.x},${target.y}`,
      );
      gesture.label.textContent = target.date;
      const rect = this.viewport.getBoundingClientRect();
      gesture.label.style.left =
        Math.max(
          8,
          Math.min(rect.width - 110, event.clientX - rect.left + 14),
        ) + "px";
      gesture.label.style.top =
        Math.max(8, Math.min(rect.height - 32, event.clientY - rect.top + 14)) +
        "px";
    };
    const autoPan = (time) => {
      if (!gesture) return;
      const dt = Math.min(40, time - gesture.time) / 1000;
      gesture.time = time;
      if (gesture.moved) {
        const rect = this.viewport.getBoundingClientRect();
        const pointer = gesture.pointer;
        const nearCanvas =
          pointer.clientX >= rect.left - 24 &&
          pointer.clientX <= rect.right + 24 &&
          pointer.clientY >= rect.top - 24 &&
          pointer.clientY <= rect.bottom + 24;
        const speed = (position, low, high) => {
          const zone = Math.min(64, (high - low) / 4);
          if (position < low + zone)
            return 620 * Math.min(1, (low + zone - position) / zone);
          if (position > high - zone)
            return -620 * Math.min(1, (position - high + zone) / zone);
          return 0;
        };
        if (nearCanvas) {
          const dx = speed(pointer.clientX, rect.left, rect.right) * dt;
          const dy = speed(pointer.clientY, rect.top, rect.bottom) * dt;
          if (dx || dy) {
            this.panX += dx;
            this.panY += dy;
            this.applyCamera();
          }
        }
        drawPreview(pointer);
      }
      gesture.frame = requestAnimationFrame(autoPan);
    };
    handle.addEventListener("pointermove", (event) => {
      if (!gesture) return;
      gesture.pointer = { clientX: event.clientX, clientY: event.clientY };
      gesture.moved ||=
        Math.hypot(
          event.clientX - gesture.startX,
          event.clientY - gesture.startY,
        ) > 5;
      drawPreview(gesture.pointer);
    });
    handle.addEventListener("pointerup", (event) => {
      if (!gesture) return;
      event.stopPropagation();
      const moved = gesture.moved,
        target = targetAt(event);
      clear();
      if (moved && target.inside)
        this.onCreate?.(node, { date: target.date, row: target.row });
    });
    handle.addEventListener("pointercancel", clear);
    handle.addEventListener("lostpointercapture", clear);
    handle.addEventListener("keydown", (event) => {
      if (event.key === "Escape") clear();
    });
    handle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.detail === 0)
        this.onCreate?.(node, { date: node.date, row: node.row + 1 });
    });
    return handle;
  }

  previewPosition(node, y) {
    node.y = y;
    const item = this.cards.get(node.id);
    item.card.style.top = y + "px";
    item.handle.style.top = y + this.layout.nodeHeight / 2 + "px";
    for (const { edge, path } of this.paths) {
      const d = wirePath(edge, this.layout, this.project.edges);
      path.setAttribute("d", d);
    }
  }

  highlight() {
    if (!this.project) return;
    const related = this.selected
      ? relatives(this.project.edges, this.selected)
      : new Set(this.project.nodes.map((n) => n.id));
    let matches = 0;
    for (const node of this.project.nodes) {
      const { card } = this.cards.get(node.id);
      const match =
        !this.query ||
        [
          node.title,
          node.date,
          node.summary,
          node.configuration,
          ...node.changes,
        ]
          .join(" ")
          .toLowerCase()
          .includes(this.query);
      if (match) matches++;
      card.classList.toggle("is-selected", node.id === this.selected);
      card.classList.toggle(
        "is-upstream",
        Boolean(this.selected) &&
          node.id !== this.selected &&
          related.has(node.id),
      );
      card.classList.toggle("is-muted", !related.has(node.id));

      card.classList.toggle("is-search-match", Boolean(this.query) && match);
      card.setAttribute("aria-pressed", String(node.id === this.selected));
    }
    for (const { edge, path } of this.paths) {
      const on = related.has(edge.from) && related.has(edge.to);
      path.classList.toggle("is-related", on);
      path.classList.toggle("is-muted", !on);
    }
    document.querySelector("#map-message").textContent = this.query
      ? t("搜索匹配", { n: matches })
      : this.selected
        ? t("已高亮当前版本及全部上游；点击空白恢复全图")
        : t("点击卡片追溯上游，点击空白恢复全图");
    document.querySelector("#focus").disabled = !this.selected;
  }
  select(id) {
    this.selected = id;
    this.highlight();
  }
  search(query) {
    this.query = query.trim().toLowerCase();
    this.highlight();
  }
  fit() {
    if (!this.layout) return;
    this.scale = Math.min(
      1.05,
      (this.viewport.clientWidth - 36) / this.layout.width,
      (this.viewport.clientHeight - 36) / this.layout.height,
    );
    this.panX =
      (this.viewport.clientWidth - this.layout.width * this.scale) / 2;
    this.panY =
      (this.viewport.clientHeight - this.layout.height * this.scale) / 2;
    this.fitted = true;
    this.applyCamera();
  }
  zoom(
    next,
    x = this.viewport.clientWidth / 2,
    y = this.viewport.clientHeight / 2,
  ) {
    next = Math.max(0.15, Math.min(2, next));
    const ratio = next / this.scale;
    this.panX = x - (x - this.panX) * ratio;
    this.panY = y - (y - this.panY) * ratio;
    this.scale = next;
    this.applyCamera();
  }
  focus(id) {
    const node = this.layout?.nodes.find((n) => n.id === id);
    if (!node) return;
    this.scale = 1;
    this.panX =
      this.viewport.clientWidth / 2 - (node.x + this.layout.nodeWidth / 2);
    this.panY =
      this.viewport.clientHeight / 2 - (node.y + this.layout.nodeHeight / 2);
    this.applyCamera();
  }
  applyCamera() {
    this.world.style.setProperty("--map-scale", this.scale);
    this.world.style.transform = `translate(${this.panX}px,${this.panY}px) scale(${this.scale})`;
    this.viewport.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
    document.querySelector("#zoom-level").value =
      Math.round(this.scale * 100) + "%";
  }
}
