import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  normalizeProject,
  relatives,
  layoutProject,
  wirePath,
  safeLink,
} from "../src/core/graph.js";

const project = {
  schemaVersion: 1,
  title: "test",
  nodes: [
    { id: "base", title: "基线", date: "2026-11-01" },
    { id: "a", title: "A", date: "2026-11-02" },
    { id: "b", title: "B", date: "2026-11-02" },
    { id: "merge", title: "合并", date: "2026-11-03" },
  ],
  edges: [
    { from: "base", to: "a", kind: "branch" },
    { from: "base", to: "b", kind: "branch" },
    { from: "a", to: "merge", kind: "branch" },
    { from: "b", to: "merge", kind: "merge" },
  ],
};

test("all upstream parents are included; descendants and sibling branches are excluded", () => {
  assert.deepEqual([...relatives(project.edges, "merge")].sort(), [
    "a",
    "b",
    "base",
    "merge",
  ]);
  assert.deepEqual([...relatives(project.edges, "a")].sort(), ["a", "base"]);
  assert.deepEqual([...relatives(project.edges, "base")], ["base"]);
});
test("cycles, duplicate IDs and missing parents are rejected before saving", () => {
  assert.throws(
    () =>
      normalizeProject({
        ...project,
        edges: [...project.edges, { from: "merge", to: "base" }],
      }),
    /循环/,
  );
  assert.throws(
    () =>
      normalizeProject({
        ...project,
        nodes: [...project.nodes, project.nodes[0]],
      }),
    /重复/,
  );
  assert.throws(
    () =>
      normalizeProject({ ...project, edges: [{ from: "missing", to: "a" }] }),
    /不存在/,
  );
});
test("date columns share x positions, rows do not collide, and links stay curved", () => {
  const p = normalizeProject(project),
    layout = layoutProject(p);
  const a = layout.nodes.find((n) => n.id === "a"),
    b = layout.nodes.find((n) => n.id === "b");
  assert.equal(a.x, b.x);
  assert.notEqual(a.y, b.y);
  for (const edge of p.edges) {
    const path = wirePath(edge, layout, p.edges);
    assert.match(path, /[LC]/);
    assert.doesNotMatch(path, /[QHV]/);
  }
});

test("new continuations inherit their upstream lane instead of starting at the top", () => {
  const layout = layoutProject(
    normalizeProject({
      schemaVersion: 1,
      nodes: [
        { id: "later", title: "Later", date: "2026-01-03" },
        { id: "first", title: "First", date: "2026-01-01", row: 3 },
        { id: "middle", title: "Middle", date: "2026-01-02" },
      ],
      edges: [
        { from: "first", to: "middle" },
        { from: "middle", to: "later" },
      ],
    }),
  );
  assert.equal(new Set(layout.nodes.map((node) => node.y)).size, 1);
  assert.ok(layout.nodes.every((node) => node.row === 3));
});

test("same-day successors stay in the date column below their upstream card", () => {
  const layout = layoutProject(
    normalizeProject({
      schemaVersion: 1,
      nodes: [
        { id: "child", title: "Child", date: "2026-01-01" },
        { id: "parent", title: "Parent", date: "2026-01-01", row: 2 },
        { id: "grandchild", title: "Grandchild", date: "2026-01-01" },
      ],
      edges: [
        { from: "parent", to: "child" },
        { from: "child", to: "grandchild" },
      ],
    }),
  );
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  assert.equal(nodes.get("child").x, nodes.get("parent").x);
  assert.ok(nodes.get("child").y > nodes.get("parent").y);
  assert.ok(nodes.get("grandchild").y > nodes.get("child").y);
});

test("new branches use nearby free lanes without moving saved cards", () => {
  const layout = layoutProject(
    normalizeProject({
      schemaVersion: 1,
      nodes: [
        { id: "parent", title: "Parent", date: "2026-01-01", row: 2 },
        { id: "saved", title: "Saved", date: "2026-01-02", row: 2 },
        { id: "a", title: "A", date: "2026-01-02" },
        { id: "b", title: "B", date: "2026-01-02" },
      ],
      edges: [
        { from: "parent", to: "saved" },
        { from: "parent", to: "a" },
        { from: "parent", to: "b" },
      ],
    }),
  );
  const rows = Object.fromEntries(
    layout.nodes.map((node) => [node.id, node.row]),
  );
  assert.equal(rows.saved, 2);
  assert.equal(rows.a, 3);
  assert.equal(rows.b, 1);
});

test("fine-tuning inherits its parent lane when another input is a merge", () => {
  const layout = layoutProject(
    normalizeProject({
      schemaVersion: 1,
      nodes: [
        { id: "reference", title: "Reference", date: "2026-01-01", row: 0 },
        { id: "parent", title: "Parent", date: "2026-01-01", row: 4 },
        { id: "next", title: "Next", date: "2026-01-02" },
      ],
      edges: [
        { from: "reference", to: "next", kind: "merge" },
        { from: "parent", to: "next", kind: "finetune" },
      ],
    }),
  );
  assert.equal(layout.nodes.find((node) => node.id === "next").row, 4);
});

test("an aligned cross-date link stays straight even when another date column is present", () => {
  const layout = {
    nodeWidth: 250,
    nodeHeight: 162,
    nodes: [
      { id: "a", x: 40, y: 96 },
      { id: "middle", x: 380, y: 504 },
      { id: "b", x: 720, y: 96 },
    ],
  };
  assert.equal(
    wirePath({ from: "a", to: "b" }, layout, []),
    "M290,177 L720,177",
  );
});

test("an unobstructed diagonal continuation retains the monitor cubic style", () => {
  const layout = {
    nodeWidth: 250,
    nodeHeight: 162,
    nodes: [
      { id: "a", x: 40, y: 96 },
      { id: "b", x: 380, y: 300 },
    ],
  };
  assert.equal(
    wirePath({ from: "a", to: "b" }, layout, []),
    "M290,177 C335,177 335,381 380,381",
  );
});

test("blocked links, same-day loops and reverse-date links have finite rounded routes", () => {
  const layout = {
    nodeWidth: 250,
    nodeHeight: 162,
    nodes: [
      { id: "a", x: 40, y: 96 },
      { id: "middle", x: 380, y: 96 },
      { id: "b", x: 720, y: 96 },
      { id: "c", x: 40, y: 504 },
    ],
  };
  for (const edge of [
    { from: "a", to: "b" },
    { from: "a", to: "c" },
    { from: "b", to: "c" },
  ]) {
    const path = wirePath(edge, layout, [edge]);
    assert.match(path, /C/);
    assert.doesNotMatch(path, /L|NaN|undefined|Infinity/);
  }
});
test("empty projects and invalid dates are handled", () => {
  assert.equal(
    layoutProject(normalizeProject({ schemaVersion: 1, nodes: [], edges: [] }))
      .nodes.length,
    0,
  );
  assert.throws(
    () =>
      normalizeProject({
        ...project,
        nodes: [{ id: "x", title: "x", date: "2026-02-31" }],
      }),
    /日期/,
  );
});
test("user text is retained as text, while unsafe links are not navigable", () => {
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("file:///D:/secret"), null);
  assert.equal(
    safeLink("https://example.com/report"),
    "https://example.com/report",
  );
  const p = normalizeProject({
    ...project,
    title: "<script>literal text</script>",
  });
  assert.equal(p.title, "<script>literal text</script>");
});
test("bundled examples are valid projects", async () => {
  for (const name of [
    "demo.zh-CN",
    "demo.en",
    "branching.zh-CN",
    "branching.en",
  ]) {
    const example = JSON.parse(
      await readFile(
        new URL("../examples/" + name + ".json", import.meta.url),
        "utf8",
      ),
    );
    assert.ok(normalizeProject(example).nodes.length > 0);
  }
});
