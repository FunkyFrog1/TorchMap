import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { replaceFile } from "./files.mjs";

const profileCookie = "torchmap_board_profile";
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export async function boardLayout(root, store, url, request, response, body) {
  const project = url.searchParams.get("project") || "default";
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(project))
    throw Error("Invalid project ID");
  let profile = (request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === profileCookie)?.[1];
  if (!uuid.test(profile ?? "")) {
    if (request.method !== "GET")
      throw Error("Open the board before saving its layout");
    profile = randomUUID();
    response.setHeader(
      "Set-Cookie",
      `${profileCookie}=${profile}; Path=/api/board-layout; HttpOnly; SameSite=Strict; Max-Age=31536000`,
    );
  }
  const directory = path.join(root, project);
  const file = path.join(directory, profile + ".json");
  if (request.method === "GET") {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return null;
    }
  }
  const map = await store.map(project);
  const rows = (values) =>
    Object.fromEntries(
      map.nodes.flatMap(({ id }) => {
        const row = values?.[id];
        return Number.isInteger(row) && Math.abs(row) <= 10000
          ? [[id, row]]
          : [];
      }),
    );
  const layout = {
    mode: body?.mode === "generation" ? "generation" : "date",
    rows: rows(body?.rows),
    generationRows: rows(body?.generationRows),
  };
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = file + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify(layout), { mode: 0o600 });
  await replaceFile(temporary, file);
  return layout;
}
