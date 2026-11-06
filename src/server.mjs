import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { unlinkSync } from "node:fs";
import { spawn } from "node:child_process";
import { Projects } from "./server/projects.mjs";
import { service } from "./server/http.mjs";
const src = path.dirname(fileURLToPath(import.meta.url)),
  root = path.dirname(src),
  port = Number(process.env.PORT ?? 18770);
const legacy = path.resolve(
  process.env.EXPERIMENT_MAP_DATA_FILE || path.join(root, "data/project.json"),
);
const home = path.resolve(
  process.env.TENSORMAP_HOME || path.join(path.dirname(legacy), "tensormap"),
);
const lock = path.join(home, "writer.lock"),
  open = process.argv.includes("--open");
function browser(url) {
  if (process.platform === "win32")
    spawn("rundll32.exe", ["url.dll,FileProtocolHandler", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
}
async function main() {
  if (open && port) {
    const url = "http://127.0.0.1:" + port + "/";
    try {
      const r = await fetch(url + "api/health", {
        signal: AbortSignal.timeout(600),
      });
      if ((await r.json()).application === "tensormap") {
        browser(url);
        return;
      }
    } catch {}
  }
  await mkdir(home, { recursive: true });
  try {
    await writeFile(lock, JSON.stringify({ pid: process.pid, port }), {
      flag: "wx",
    });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    throw Error(
      "Workspace already locked: " +
        lock +
        " (verify the recorded process before removing a stale lock)",
    );
  }
  process.once("exit", () => {
    try {
      unlinkSync(lock);
    } catch {}
  });
  for (const sig of ["SIGINT", "SIGTERM"])
    process.once(sig, () => process.exit(0));
  const store = new Projects(home);
  await store.initialize(legacy, path.join(root, "examples/demo.zh-CN.json"));
  const server = service(store, src);
  server.on("error", (e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    const url = "http://127.0.0.1:" + server.address().port + "/";
    console.log("TorchMap  " + url);
    if (open) browser(url);
  });
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
