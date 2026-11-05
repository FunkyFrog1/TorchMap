#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { protocol } from "./protocol/events.mjs";
const base = process.env.TENSORMAP_URL || "http://127.0.0.1:18770";
const project = process.env.TENSORMAP_PROJECT || "default";
const [cmd, ...args] = process.argv.slice(2);
const help = `TensorMap | CLI
  projects                         list projects
  project <title>                  create an empty project
  version <json-file>              create {node, parents:[{id,kind}]}
  snapshot                         inspect runs, checkpoints and attachments
  event <json-file|->              publish one protocol event; keep its id for retries
  metrics <run-id>                 export all scalar samples as JSONL
  attach <version> <file> [run]    attach a human-authored .md, .png, or .jpg
  exec <registered-run> <attempt> [--resume checkpoint] -- <program> [args...]
                                   supervise a local direct child; Ctrl+C requests stop
  TENSORMAP_URL and TENSORMAP_PROJECT select the service and project.`;
async function call(route, body, params = {}) {
  const url = new URL("/api/" + route, base);
  url.search = new URLSearchParams({ project, ...params });
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await res.json();
  if (!res.ok) throw Error(result.error || res.statusText);
  return result;
}
async function fileJSON(file) {
  if (file === "-") {
    const chunks = [];
    for await (const x of process.stdin) chunks.push(x);
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  return JSON.parse((await readFile(file, "utf8")).replace(/^\uFEFF/, ""));
}
const publish = (payload) =>
  call("events", { protocol, id: randomUUID(), ...payload });
async function execRun() {
  const cut = args.indexOf("--"),
    [runId, n, opt, ck] = args,
    attempt = Number(n);
  if (!(cut === 2 || (cut === 4 && opt === "--resume")) || !args[cut + 1])
    throw Error(help);
  const common = { runId, attempt };
  await publish({
    ...common,
    type: "attempt.started",
    ...(cut === 4 ? { resumeFrom: ck } : {}),
  });
  const child = spawn(args[cut + 1], args.slice(cut + 2), {
    shell: false,
    stdio: "inherit",
    env: {
      ...process.env,
      TENSORMAP_RUN: runId,
      TENSORMAP_ATTEMPT: String(attempt),
    },
  });
  let stopping = false,
    beating = false;
  const stop = () => {
    stopping = true;
    child.kill("SIGTERM");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  const timer = setInterval(async () => {
    if (beating) return;
    beating = true;
    try {
      await publish({ ...common, type: "heartbeat" });
    } catch (e) {
      console.error(e.message);
    } finally {
      beating = false;
    }
  }, 30000);
  let code, reason;
  try {
    [code, reason] = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (c, s) => resolve([c, s]));
    });
  } catch (e) {
    reason = e.message;
    code = 1;
  } finally {
    clearInterval(timer);
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
  await publish({
    ...common,
    type: "attempt.ended",
    status: stopping ? "stopped" : code === 0 ? "succeeded" : "failed",
    reason: String(reason ?? code),
  });
  process.exitCode = stopping ? 130 : (code ?? 1);
}
async function main() {
  if (!cmd || ["help", "--help", "-h"].includes(cmd)) {
    console.log(help);
    return;
  }
  if (cmd === "exec") return execRun();
  let o;
  if (cmd === "projects" || cmd === "snapshot") o = await call(cmd);
  else if (cmd === "project")
    o = await call("projects", {
      schemaVersion: 1,
      title: args[0],
      nodes: [],
      edges: [],
    });
  else if (cmd === "version")
    o = await call("versions", await fileJSON(args[0]));
  else if (cmd === "event") o = await publish(await fileJSON(args[0]));
  else if (cmd === "metrics") {
    let after = 0;
    while (true) {
      const page = await call("metrics", null, { run: args[0], after });
      for (const p of page.items) console.log(JSON.stringify(p));
      if (!page.more) break;
      after = page.next;
    }
    return;
  } else if (cmd === "attach") {
    const [versionId, file, runId] = args,
      format = path.extname(file).slice(1).toLowerCase().replace("jpeg", "jpg");
    o = await call("artifacts", {
      protocol,
      id: randomUUID(),
      versionId,
      runId,
      format,
      name: path.basename(file),
      content: (await readFile(file)).toString("base64"),
    });
  } else throw Error(help);
  console.log(JSON.stringify(o, null, 2));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
