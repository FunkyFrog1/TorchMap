import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { api } from "./api.mjs";
const webFiles = new Set([
  "app.js",
  "vendor/markdown-it.min.js",
  "canvas.js",
  "editor.js",
  "i18n.js",
  "interface.js",
  "storage.js",
  "themes.js",
  "project-monitor.js",
  "monitor-views.js",
  "monitor-chart.js",
  "styles/monitor.css",
  "index.html",
  "styles/base.css",
  "styles/controls.css",
  "styles/map.css",
  "styles/themes.css",
]);
async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const c of request) {
    size += c.length;
    if (size > 6 * 1024 * 1024) throw Error("Request too large");
    chunks.push(c);
  }
  return size ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null;
}
export function service(store, src) {
  return http.createServer(async (req, res) => {
    const send = (code, type, content) => {
      res.writeHead(code, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(content);
    };
    try {
      if (
        !/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || "") ||
        (req.headers.origin &&
          req.headers.origin !== "http://" + req.headers.host)
      )
        return send(403, "text/plain", "Loopback clients only");
      const url = new URL(req.url, "http://127.0.0.1");
      if (
        store.readOnly &&
        url.pathname === "/" &&
        !url.searchParams.has("project")
      ) {
        const [first] = await store.list();
        if (first) {
          url.searchParams.set("project", first.id);
          res.writeHead(302, { Location: "/" + url.search });
          return res.end();
        }
      }
      if (url.pathname.startsWith("/api/")) {
        if (store.readOnly && req.method !== "GET")
          return send(
            405,
            "application/json",
            JSON.stringify({ error: "Directory project is read-only" }),
          );
        if (req.method === "GET" && url.pathname === "/api/asset") {
          const l = await store.ledger(
            url.searchParams.get("project") || "default",
          );
          const a = await l.asset(url.searchParams.get("id"));
          return send(
            200,
            {
              md: "text/plain; charset=utf-8",
              png: "image/png",
              jpg: "image/jpeg",
            }[a.format],
            a.data,
          );
        }
        const body = req.method === "GET" ? null : await readBody(req);
        const action = () => api(store, url, req.method, body, req);
        return send(
          200,
          "application/json; charset=utf-8",
          JSON.stringify(
            await (req.method === "GET" ? action() : store.write(action)),
          ),
        );
      }
      const name = url.pathname.slice(1) || "index.html";
      if (
        req.method === "GET" &&
        (webFiles.has(name) ||
          ["core/graph.js", "core/routing.js"].includes(name))
      ) {
        const file = path.join(src, webFiles.has(name) ? "web" : "", "" + name);
        return send(
          200,
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
          }[path.extname(name)] + "; charset=utf-8",
          await readFile(file),
        );
      }
      send(name === "favicon.ico" ? 204 : 404, "text/plain", "");
    } catch (e) {
      send(
        e.status ?? (e.code === "ENOENT" ? 404 : 400),
        "application/json; charset=utf-8",
        JSON.stringify({ error: e.message }),
      );
    }
  });
}
