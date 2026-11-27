// Each revision is stored together with the exact rows it describes.
export function mergeReply(previous, packet) {
  if (packet.full) return { revision: packet.revision, data: packet.full };
  if (previous?.revision === packet.revision) return previous;
  if (!previous || !packet.changes) throw Error("Missing monitor baseline");
  const data = { ...previous.data };
  for (const [name, change] of Object.entries(packet.changes)) {
    const rows = new Map(data[name].map((row) => [row.id, row]));
    for (const id of change.remove) rows.delete(id);
    for (const row of change.put) rows.set(row.id, row);
    data[name] = change.order
      ? change.order.map((id) => rows.get(id))
      : [...rows.values()];
  }
  return { revision: packet.revision, data };
}

let dbPromise;
function database() {
  return (dbPromise ??= new Promise((resolve) => {
    try {
      const open = indexedDB.open("torchmap-monitor-v1", 1);
      open.onupgradeneeded = () =>
        open.result.createObjectStore("views").createIndex("time", "time");
      open.onsuccess = () => resolve(open.result);
      open.onerror = open.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}
export async function readBaseline(key) {
  try {
    const db = await database();
    if (!db) return null;
    return await new Promise((resolve) => {
      const request = db.transaction("views").objectStore("views").get(key);
      request.onsuccess = () => resolve(request.result?.entry);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
export async function saveBaseline(key, entry) {
  try {
    const db = await database();
    if (!db) return;
    const store = db.transaction("views", "readwrite").objectStore("views");
    store.put({ time: Date.now(), entry }, key);
    const count = store.count();
    count.onsuccess = () => {
      let excess = count.result - 16;
      if (excess <= 0) return;
      const oldest = store.index("time").openKeyCursor();
      oldest.onsuccess = () => {
        const cursor = oldest.result;
        if (!cursor || excess <= 0) return;
        store.delete(cursor.primaryKey);
        excess--;
        cursor.continue();
      };
    };
  } catch {
    /* In-memory refreshing also works with storage disabled. */
  }
}
