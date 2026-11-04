import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import http from "node:http";
import {
  readFile,
  writeFile,
  rename,
  mkdir,
  copyFile,
  access,
  readdir,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
import { normalizeProject } from "./core/graph.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 18770);
const projectFile = path.resolve(
  process.env.EXPERIMENT_MAP_DATA_FILE || path.join(root, "data/project.json"),
);
const assets = new Map([
  ["/core/graph.js", ["core/graph.js", "text/javascript"]],
  ["/core/routing.js", ["core/routing.js", "text/javascript"]],
  ["/", ["web/index.html", "text/html"]],
  ...["base", "map", "themes", "controls"].map((name) => [
    "/styles/" + name + ".css",
    ["web/styles/" + name + ".css", "text/css"],
  ]),
  ...["app", "canvas", "editor", "i18n", "storage", "themes", "interface"].map((name) => [
    "/" + name + ".js",
    ["web/" + name + ".js", "text/javascript"],
  ]),
]);
let writes = Promise.resolve();

async function replaceFile(source, target) {
  // Windows can briefly deny rename while a project-list read or antivirus
  // holds the file. Retry the atomic rename; never delete the previous file.
  for (let attempt = 0; ; attempt++) {
    try {
      return await rename(source, target);
    } catch (error) {
      if (!["EPERM", "EBUSY"].includes(error.code) || attempt >= 5) throw error;
      await delay(25 * (attempt + 1));
    }
  }
}

async function body(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 2 * 1024 * 1024) throw new Error("项目文件不能超过 2 MB");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function respond(response, status, value, type = "application/json") {
  response.writeHead(status, {
    "Content-Type": type + "; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(
    typeof value === "string" || Buffer.isBuffer(value)
      ? value
      : JSON.stringify(value),
  );
}

// Seed only a missing local data file; never replace an existing user project.
await mkdir(path.dirname(projectFile), { recursive: true });
try {
  await writeFile(
    projectFile,
    await readFile(path.join(root, "examples/demo.zh-CN.json")),
    { flag: "wx" },
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}

const server = http.createServer(async (request, response) => {
  try {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(request.headers.host || ""))
      return respond(response, 403, { error: "请使用本机 localhost 地址访问" });
    const url = new URL(request.url, "http://127.0.0.1:" + port);
    if (url.pathname === "/api/health" && request.method === "GET")
      return respond(response, 200, { application: "experiment-map" });
    if (
      request.method !== "GET" &&
      request.headers.origin &&
      request.headers.origin !== "http://" + request.headers.host
    )
      return respond(response, 403, { error: "只接受当前本地页面的保存请求" });
    const projectId = url.searchParams.get("project") || "default";
    if (projectId !== "default" && !/^[a-f0-9-]{36}$/.test(projectId))
      return respond(response, 400, { error: "Invalid project ID" });
    const projectsDirectory = path.join(path.dirname(projectFile), "projects");
    const selectedFile =
      projectId === "default"
        ? projectFile
        : path.join(projectsDirectory, projectId + ".json");
    if (url.pathname === "/api/projects") {
      await mkdir(projectsDirectory, { recursive: true });
      if (request.method === "GET") {
        const entries = [
          ["default", projectFile],
          ...(await readdir(projectsDirectory))
            .filter((name) => /^[a-f0-9-]{36}\.json$/.test(name))
            .map((name) => [
              name.slice(0, -5),
              path.join(projectsDirectory, name),
            ]),
        ];
        const projects = await Promise.all(
          entries.map(async ([id, file]) => {
            const value = JSON.parse(await readFile(file, "utf8"));
            return { id, title: value.title, updatedAt: value.updatedAt };
          }),
        );
        return respond(response, 200, projects);
      }
      if (request.method === "POST") {
        const value = normalizeProject(await body(request));
        value.updatedAt = new Date().toISOString();
        const id = randomUUID();
        await writeFile(
          path.join(projectsDirectory, id + ".json"),
          JSON.stringify(value, null, 2) + "\n",
          { flag: "wx" },
        );
        return respond(response, 201, { id });
      }
      if (request.method === "DELETE" && projectId !== "default") {
        const archiveProject = async () => {
          const archive = path.join(projectsDirectory, "archive");
          await mkdir(archive, { recursive: true });
          await rename(selectedFile, path.join(archive, projectId + ".json"));
          await rename(
            path.join(projectsDirectory, projectId + ".backup.json"),
            path.join(archive, projectId + ".backup.json"),
          ).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
        };
        const pending = writes.then(archiveProject);
        writes = pending.catch(() => {});
        await pending;
        return respond(response, 200, { archived: true });
      }
      return respond(response, 405, { error: "不支持该请求" });
    }
    if (url.pathname === "/api/project") {
      if (request.method === "GET")
        return respond(response, 200, await readFile(selectedFile));
      if (request.method === "PUT") {
        // Accept only same-origin browser writes to this loopback-only service.
        if (
          request.headers.origin &&
          request.headers.origin !== "http://" + request.headers.host
        )
          return respond(response, 403, {
            error: "只接受当前本地页面的保存请求",
          });
        const project = normalizeProject(await body(request));
        project.updatedAt = new Date().toISOString();
        const save = async () => {
          if (projectId !== "default") await access(selectedFile);
          await mkdir(path.dirname(selectedFile), { recursive: true });
          await copyFile(
            selectedFile,
            path.join(
              path.dirname(selectedFile),
              path.basename(selectedFile, path.extname(selectedFile)) +
                ".backup.json",
            ),
          ).catch((error) => {
            if (error.code !== "ENOENT") throw error;
          });
          const temporary = selectedFile + ".tmp";
          await writeFile(
            temporary,
            JSON.stringify(project, null, 2) + "\n",
            "utf8",
          );
          await replaceFile(temporary, selectedFile);
        };
        const pending = writes.then(save);
        writes = pending.catch(() => {});
        await pending;
        return respond(response, 200, { savedAt: project.updatedAt });
      }
      return respond(response, 405, { error: "不支持该请求" });
    }
    if (request.method === "GET" && assets.has(url.pathname)) {
      const [name, type] = assets.get(url.pathname);
      return respond(
        response,
        200,
        await readFile(path.join(root, "src", name)),
        type,
      );
    }
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      return response.end();
    }
    respond(response, 404, { error: "页面不存在" });
  } catch (error) {
    respond(response, error.code === "ENOENT" ? 404 : 400, {
      error: error.message,
    });
  }
});
function openBrowser(url) {
  if (process.platform !== "win32") return;
  const browser = spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  browser.unref();
}
server.on("error", async (error) => {
  if (error.code === "EADDRINUSE" && process.argv.includes("--open")) {
    const url = "http://127.0.0.1:" + port + "/";
    try {
      const existing = await fetch(url + "api/health", {
        signal: AbortSignal.timeout(1500),
      });
      if ((await existing.json()).application === "experiment-map") {
        openBrowser(url);
        console.log("Opened the existing Experiment Map instance.");
        return;
      }
    } catch {}
  }
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is in use. Open the existing instance or set PORT.`
      : error,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  const url = "http://127.0.0.1:" + server.address().port + "/";
  console.log("Experiment Map  " + url + "\nPress Ctrl+C to stop.");
  if (process.argv.includes("--open")) openBrowser(url);
});
