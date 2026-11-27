import path from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { DirectoryStore } from "./server/directory.mjs";
import { service } from "./server/http.mjs";

if (!process.argv[2])
  throw Error("Usage: node src/directory-server.mjs <projects-root>");
const store = new DirectoryStore(path.resolve(process.argv[2]));
const projects = await store.list();
if (!projects.length) throw Error("No TorchMap directory projects found");
const layoutRoot = process.env.TORCHMAP_LAYOUT_HOME ||
  path.join(homedir(), ".local", "share", "torchmap", "board-layouts");
const server = service(store, path.dirname(fileURLToPath(import.meta.url)), { layoutRoot });
server.listen(Number(process.env.PORT ?? 18772), "127.0.0.1", () =>
  console.log(
    "TorchMap directories http://127.0.0.1:" + server.address().port + "/",
  ),
);
