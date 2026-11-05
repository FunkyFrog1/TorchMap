import path from "node:path";
import { fileURLToPath } from "node:url";
import { DirectoryStore } from "./server/directory.mjs";
import { service } from "./server/http.mjs";

if (!process.argv[2])
  throw Error("Usage: node src/directory-server.mjs <projects-root>");
const store = new DirectoryStore(path.resolve(process.argv[2]));
const projects = await store.list();
if (!projects.length) throw Error("No TensorMap directory projects found");
const server = service(store, path.dirname(fileURLToPath(import.meta.url)));
server.listen(Number(process.env.PORT ?? 18772), "127.0.0.1", () =>
  console.log(
    "TensorMap directories http://127.0.0.1:" + server.address().port + "/",
  ),
);
