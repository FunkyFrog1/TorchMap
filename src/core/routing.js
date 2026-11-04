// Routing uses the actual card rectangles, rather than treating an entire
// date column as blocked. Clear horizontal connections stay straight.
function intersects(a, b, box) {
  let low = 0,
    high = 1;
  for (const [p, d, min, max] of [
    [a.x, b.x - a.x, box.left, box.right],
    [a.y, b.y - a.y, box.top, box.bottom],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (p < min || p > max) return false;
      continue;
    }
    const t1 = (min - p) / d,
      t2 = (max - p) / d;
    low = Math.max(low, Math.min(t1, t2));
    high = Math.min(high, Math.max(t1, t2));
    if (low > high) return false;
  }
  return true;
}
function clear(points, boxes) {
  return points
    .slice(1)
    .every((point, index) =>
      boxes.every((box) => !intersects(points[index], point, box)),
    );
}
function cubic(a, b, c, d) {
  const points = [];
  for (let i = 0; i <= 64; i++) {
    const t = i / 64,
      u = 1 - t;
    points.push({
      x:
        u * u * u * a.x +
        3 * u * u * t * b.x +
        3 * u * t * t * c.x +
        t * t * t * d.x,
      y:
        u * u * u * a.y +
        3 * u * u * t * b.y +
        3 * u * t * t * c.y +
        t * t * t * d.y,
    });
  }
  return points;
}
function smoothRoute(start, end, entry, exit, y, direction) {
  const first = Math.min(38, Math.abs(entry - start.x) * 0.45);
  const last = Math.min(38, Math.abs(end.x - exit) * 0.45);
  const span = (exit - entry) / 3;
  const segments = [
    [
      start,
      { x: start.x + direction * first, y: start.y },
      { x: entry - direction * first, y },
      { x: entry, y },
    ],
    [
      { x: entry, y },
      { x: entry + span, y },
      { x: exit - span, y },
      { x: exit, y },
    ],
    [
      { x: exit, y },
      { x: exit + direction * last, y },
      { x: end.x - direction * last, y: end.y },
      end,
    ],
  ];
  return {
    path:
      `M${start.x},${start.y}` +
      segments
        .map(([, b, c, d]) => ` C${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`)
        .join(""),
    points: segments.flatMap((segment) => cubic(...segment)),
  };
}
export function routeWire(edge, layout, edges) {
  const a = layout.nodes.find((node) => node.id === edge.from),
    b = layout.nodes.find((node) => node.id === edge.to);
  const w = layout.nodeWidth,
    h = layout.nodeHeight;
  const backward = b.x < a.x,
    sameDay = a.x === b.x;
  const start = { x: backward ? a.x : a.x + w, y: a.y + h / 2 };
  const end = { x: backward || sameDay ? b.x + w : b.x, y: b.y + h / 2 };
  const obstacles = layout.nodes.filter(
    (node) => node.id !== a.id && node.id !== b.id,
  );
  const boxes = (padding) =>
    obstacles.map((node) => ({
      left: node.x - padding,
      right: node.x + w + padding,
      top: node.y - padding,
      bottom: node.y + h + padding,
    }));
  const physical = boxes(8);
  if (!sameDay && start.y === end.y && clear([start, end], physical))
    return `M${start.x},${start.y} L${end.x},${end.y}`;
  if (!sameDay && !backward) {
    const bend = Math.max(28, (end.x - start.x) / 2);
    const c1 = { x: start.x + bend, y: start.y },
      c2 = { x: end.x - bend, y: end.y };
    if (clear(cubic(start, c1, c2, end), physical))
      return `M${start.x},${start.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`;
  }
  // Match the original monitor: smooth side loops and cubic detours with
  // horizontal tangents, rather than diagonal shortcuts or elbow routing.
  if (sameDay) {
    const siblings = edges.filter(
      (item) =>
        item.from === edge.from &&
        layout.nodes.find((node) => node.id === item.to).x === b.x,
    );
    const bend = Math.min(86, 50 + 18 * Math.max(0, siblings.indexOf(edge)));
    return `M${start.x},${start.y} C${start.x + bend},${start.y} ${start.x + bend},${end.y} ${end.x},${end.y}`;
  }
  const between = layout.nodes.filter(
    (node) => node.x > Math.min(a.x, b.x) && node.x < Math.max(a.x, b.x),
  );
  const direction = backward ? -1 : 1;
  const entry = between.length
    ? backward
      ? Math.max(...between.map((node) => node.x + w)) + 24
      : Math.min(...between.map((node) => node.x)) - 24
    : start.x + direction * 40;
  const exit = between.length
    ? backward
      ? Math.min(...between.map((node) => node.x)) - 24
      : Math.max(...between.map((node) => node.x + w)) + 24
    : end.x - direction * 40;
  const middle = (start.y + end.y) / 2;
  const lanes = [
    ...new Set([
      middle,
      start.y,
      end.y,
      72,
      ...layout.nodes.flatMap((node) => [node.y - 28, node.y + h + 28]),
    ]),
  ].filter((y) => y >= 72);
  lanes.sort(
    (a, b) =>
      Math.abs(start.y - a) +
        Math.abs(end.y - a) -
        (Math.abs(start.y - b) + Math.abs(end.y - b)) ||
      Math.abs(a - middle) - Math.abs(b - middle),
  );
  const routes = lanes.map((y) =>
    smoothRoute(start, end, entry, exit, y, direction),
  );
  return (
    routes.find((route) => clear(route.points, physical)) ||
    smoothRoute(start, end, entry, exit, 72, direction)
  ).path;
}
