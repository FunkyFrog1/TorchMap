import { rename } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
// Readers and virus scanners may briefly hold files on Windows. Never unlink the last valid copy.
export async function replaceFile(from, to) {
  for (let n = 0; ; n++) {
    try {
      return await rename(from, to);
    } catch (e) {
      if (n >= 5 || !["EPERM", "EBUSY"].includes(e.code)) throw e;
      await delay(30 * (n + 1));
    }
  }
}
