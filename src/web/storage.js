import { normalizeProject } from "../core/graph.js";

export const projectId =
  new URLSearchParams(location.search).get("project") || "default";
const endpoint =
  "/api/project" +
  (projectId === "default" ? "" : "?project=" + encodeURIComponent(projectId));
const DRAFT_KEY =
  "experiment-map:v1:draft:" +
  location.host +
  (projectId === "default" ? "" : ":" + projectId);
let mapRevision;
let queue = Promise.resolve(),
  revision = 0;

export async function loadProject() {
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取本地项目，请确认启动服务正常");
  const rawProject = await response.json();
  const project = normalizeProject(rawProject);
  if (rawProject.directoryMode) return { project, directoryMode: true };
  mapRevision = project.updatedAt;
  try {
    // Discard prototype drafts; they belong to the pre-release data format.
    localStorage.removeItem("experiment-map:draft:" + location.host);
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      const raw = JSON.parse(savedDraft);
      const draft = normalizeProject(raw);
      if (raw.baseRevision != null && raw.baseRevision !== mapRevision) {
        // Keep the rejected local edit for recovery; never overwrite a newer server map on reload.
        localStorage.setItem(DRAFT_KEY + ":conflict", savedDraft);
        localStorage.removeItem(DRAFT_KEY);
        return { project, recovered: false, conflict: true };
      }
      if (Date.parse(draft.updatedAt) > Date.parse(project.updatedAt || 0))
        return { project: draft, recovered: true };
      localStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }
  return { project, recovered: false };
}

export function saveProject(project, onState) {
  const current = ++revision;
  const snapshot = structuredClone(project);
  snapshot.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...snapshot, baseRevision: mapRevision }),
    );
  } catch {}
  onState("saving");
  const save = async () => {
    try {
      if (current === revision) {
        try {
          localStorage.setItem(
            DRAFT_KEY,
            JSON.stringify({ ...snapshot, baseRevision: mapRevision }),
          );
        } catch {}
      }
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Map-Revision": mapRevision ?? "",
        },
        body: JSON.stringify(snapshot),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存失败");
      mapRevision = result.savedAt;
      if (current === revision) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
        onState("saved", result.savedAt);
      }
      return true;
    } catch (error) {
      if (current === revision) onState("error", error.message);
      return false;
    }
  };
  queue = queue.then(save, save);
  return queue;
}

export function downloadProject(project) {
  const file = new Blob([JSON.stringify(project, null, 2) + "\n"], {
    type: "application/json",
  });
  const url = URL.createObjectURL(file),
    link = document.createElement("a");
  link.href = url;
  link.download =
    (project.title || "experiment-map").replace(/[<>:"/\\|?*]/g, "_") + ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
