import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { createAppStorage } from "@lib/storage";

const storage = createAppStorage("query-cache");

export const persister = createSyncStoragePersister({
  storage: {
    getItem: (key) => storage.getString(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.remove(key),
  },
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

/** Drops every query from memory and from the persisted copy, so a later account starts empty. */
export function clearQueryCache(): void {
  // `clear` also cancels the fetches in flight, so a late response cannot repopulate the cache.
  queryClient.clear();
  storage.clearAll();
}
