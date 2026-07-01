import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import { dehydrate, hydrate } from "@tanstack/react-query";
import type { InboxListPage } from "@modules/inbox/queries/options";

const HOT_CACHE_KEY = "kyomi:hot-query-cache:v1";
const HOT_CACHE_DB_NAME = "kyomi.query-cache";
const HOT_CACHE_STORE_NAME = "snapshots";
const HOT_CACHE_DB_VERSION = 1;
const HOT_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;
const PERSIST_THROTTLE_MS = 1_000;

type PersistedHotCache = {
  savedAt: number;
  state: unknown;
};

let hasHydrated = false;
let persistTimer: number | undefined;
let pendingPersist: Promise<void> | undefined;

function isHotQueryKey(queryKey: QueryKey) {
  const [family, scope] = queryKey;
  return (
    family === "folders" ||
    (family === "feeds" && scope === "followed") ||
    (family === "inbox" &&
      (scope === "items" || scope === "item-detail" || scope === "view-count")) ||
    (family === "sidebar" && scope === "inbox-summary")
  );
}

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openHotCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(HOT_CACHE_DB_NAME, HOT_CACHE_DB_VERSION);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(HOT_CACHE_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB hot cache upgrade was blocked."));
  });
}

async function readHotCache(): Promise<PersistedHotCache | null> {
  if (!canUseIndexedDb()) {
    return null;
  }

  const db = await openHotCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HOT_CACHE_STORE_NAME, "readonly");
    const request = transaction.objectStore(HOT_CACHE_STORE_NAME).get(HOT_CACHE_KEY);

    request.onsuccess = () => resolve((request.result as PersistedHotCache | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function writeHotCache(cache: PersistedHotCache): Promise<void> {
  if (!canUseIndexedDb()) {
    return;
  }

  const db = await openHotCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HOT_CACHE_STORE_NAME, "readwrite");
    transaction.objectStore(HOT_CACHE_STORE_NAME).put(cache, HOT_CACHE_KEY);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function removeHotCache(): Promise<void> {
  if (!canUseIndexedDb()) {
    return;
  }

  const db = await openHotCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HOT_CACHE_STORE_NAME, "readwrite");
    transaction.objectStore(HOT_CACHE_STORE_NAME).delete(HOT_CACHE_KEY);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function removeLegacyLocalStorageCache() {
  try {
    window.localStorage.removeItem(HOT_CACHE_KEY);
  } catch {
    // localStorage can be unavailable in private or constrained browsing contexts.
  }
}

function isValidInboxListPage(page: unknown): page is InboxListPage {
  if (!page || typeof page !== "object") {
    return false;
  }
  const candidate = page as Partial<InboxListPage>;
  return Array.isArray(candidate.items);
}

function dropCorruptInboxItemQueries(queryClient: QueryClient) {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: ["inbox", "items"] })) {
    const data = query.state.data as InfiniteData<InboxListPage> | undefined;
    if (!data?.pages?.length) {
      continue;
    }
    if (data.pages.some((page) => !isValidInboxListPage(page))) {
      queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
    }
  }
}

export function hydrateHotQueryCache(queryClient: QueryClient): Promise<void> {
  if (hasHydrated || typeof window === "undefined") {
    return Promise.resolve();
  }
  hasHydrated = true;

  return readHotCache()
    .then(async (parsed) => {
      removeLegacyLocalStorageCache();
      if (!parsed) {
        return;
      }

      if (!parsed.savedAt || Date.now() - parsed.savedAt > HOT_CACHE_MAX_AGE_MS) {
        await removeHotCache();
        return;
      }

      hydrate(queryClient, parsed.state);
      dropCorruptInboxItemQueries(queryClient);
    })
    .catch(async () => {
      await removeHotCache().catch(() => {});
    });
}

async function persistHotQueryCache(queryClient: QueryClient) {
  if (pendingPersist) {
    return pendingPersist;
  }

  pendingPersist = Promise.resolve()
    .then(async () => {
      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) =>
          query.state.status === "success" && isHotQueryKey(query.queryKey),
      });
      await writeHotCache({
        savedAt: Date.now(),
        state,
      });
    })
    .catch(async () => {
      await removeHotCache().catch(() => {});
    })
    .finally(() => {
      pendingPersist = undefined;
    });

  return pendingPersist;
}

function scheduleHotCachePersist(queryClient: QueryClient) {
  if (persistTimer) {
    return;
  }

  persistTimer = window.setTimeout(() => {
    persistTimer = undefined;
    void persistHotQueryCache(queryClient);
  }, PERSIST_THROTTLE_MS);
}

function shouldPersistQueryCacheEvent(event: unknown) {
  if (!event || typeof event !== "object") {
    return true;
  }

  const query = (event as { query?: { queryKey?: QueryKey } }).query;
  return query?.queryKey ? isHotQueryKey(query.queryKey) : true;
}

export function subscribeHotQueryCachePersistence(queryClient: QueryClient) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (!shouldPersistQueryCacheEvent(event)) {
      return;
    }
    scheduleHotCachePersist(queryClient);
  });

  return () => {
    unsubscribe();
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = undefined;
    }
  };
}
