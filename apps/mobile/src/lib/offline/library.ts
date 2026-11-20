import type { ArticleDetailDto } from "@kyomi/reader/schemas/article";
import { replay } from "@kyomi/reader/offline";
import { fetchMobileApiJson } from "../api";
import { offlineOwner } from "./owner";
import { library } from "./store";
export { offlineOwner } from "./owner";
export { library, clearOfflineLibrary } from "./store";

const listeners = new Set<() => void>();
export function subscribeToDownloads(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
let tail = Promise.resolve();
export function syncLibrary(owner: string) {
  const headers = { "x-kyomi-offline-owner": owner, "content-type": "application/json" };
  const path = (id: string) => "/api/v1/articles/" + encodeURIComponent(id);
  const next = tail.then(() =>
    replay(library, owner, {
      detail: (id) => fetchMobileApiJson<ArticleDetailDto>(path(id), { headers }),
      put: (id, suffix, body) =>
        fetchMobileApiJson<void>(path(id) + suffix, {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        }),
    }),
  );
  const complete = next.then((changed) => {
    if (changed && offlineOwner() === owner) for (const notify of listeners) notify();
  });
  tail = complete.catch(() => {});
  return complete;
}
