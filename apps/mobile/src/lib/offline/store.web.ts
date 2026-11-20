import { adopt, library as indexedLibrary } from "@kyomi/reader/offline/indexeddb";
import type { Library } from "@kyomi/reader/offline";
import { offlineOwner } from "./owner";

let reset = Promise.resolve();
export function clearOfflineLibrary(nextOwner?: string) {
  reset = reset
    .catch(() => {})
    .then(async () => {
      await adopt(null);
      if (nextOwner && offlineOwner() === nextOwner) await adopt(nextOwner);
    });
  // Storage errors also surface to the next reader or editor awaiting this reset.
  void reset.catch(() => {});
}
async function ready(owner: string) {
  await reset;
  if (!owner || offlineOwner() !== owner) throw new Error("Offline library account changed");
  await adopt(owner);
}

export const library: Library = {
  async list(owner, pendingOnly) {
    if (offlineOwner() !== owner) return [];
    await ready(owner);
    return indexedLibrary.list(owner, pendingOnly);
  },
  async edit(owner, id, change) {
    await ready(owner);
    return indexedLibrary.edit(owner, id, change);
  },
};
