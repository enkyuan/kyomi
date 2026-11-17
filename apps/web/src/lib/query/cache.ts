import type { DehydratedState, InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import { dehydrate, hydrate } from "@tanstack/react-query";
import { articleDetailSchema } from "@kyomi/reader/schemas";
import { queryKeys } from "./keys";

const HOT_CACHE_KEY = "kyomi:hot-query-cache:v2";
const HOT_CACHE_LEGACY_KEY = "kyomi:hot-query-cache:v1";
const HOT_CACHE_DB_NAME = "kyomi.query-cache";
const HOT_CACHE_STORE_NAME = "snapshots";
const HOT_CACHE_DB_VERSION = 1;
const HOT_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;
const PERSIST_THROTTLE_MS = 1_000;
const HOT_CACHE_MAX_INBOX_LISTS = 8;
const HOT_CACHE_MAX_ITEM_DETAILS = 20;

/** The hot cache only relies on a persisted inbox list page carrying an `items` array. */
type HotInboxListPage = { items: unknown[] };

type PersistedHotCache = {
  savedAt: number;
  state: DehydratedState;
};

let hasHydrated = false;
let persistTimer: number | undefined;
let pendingPersist: Promise<void> | undefined;

const HOT_QUERY_KEY_PREFIXES: readonly QueryKey[] = [
  queryKeys.folders.all,
  queryKeys.feeds.followed,
  queryKeys.inbox.items,
  queryKeys.inbox.itemDetails,
  queryKeys.inbox.viewCount,
  queryKeys.sidebar.inboxSummary,
];

function hasQueryKeyPrefix(queryKey: QueryKey, prefix: QueryKey) {
  return prefix.every((part, index) => queryKey[index] === part);
}

function isHotQueryKey(queryKey: QueryKey) {
  return HOT_QUERY_KEY_PREFIXES.some((prefix) => hasQueryKeyPrefix(queryKey, prefix));
}

function isSuccessfulHotQuery(query: { state: { status: string }; queryKey: QueryKey }) {
  return query.state.status === "success" && isHotQueryKey(query.queryKey);
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

async function removeHotCache(cacheKey: string): Promise<void> {
  if (!canUseIndexedDb()) {
    return;
  }

  const db = await openHotCacheDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(HOT_CACHE_STORE_NAME, "readwrite");
    transaction.objectStore(HOT_CACHE_STORE_NAME).delete(cacheKey);

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
    window.localStorage.removeItem(HOT_CACHE_LEGACY_KEY);
  } catch {
    // localStorage can be unavailable in private or constrained browsing contexts.
  }
}

function isValidInboxListPage(page: unknown): page is HotInboxListPage {
  if (!page || typeof page !== "object") {
    return false;
  }
  const candidate = page as Partial<HotInboxListPage>;
  return Array.isArray(candidate.items);
}

type DehydratedHotQuery = DehydratedState["queries"][number];

function isInboxQueryScope(query: DehydratedHotQuery, scope: "items" | "item-detail") {
  const prefix = scope === "items" ? queryKeys.inbox.items : queryKeys.inbox.itemDetails;
  return hasQueryKeyPrefix(query.queryKey, prefix);
}

function isValidInfiniteInboxListData(data: unknown): data is InfiniteData<HotInboxListPage> {
  if (!data || typeof data !== "object") {
    return false;
  }

  const candidate = data as Partial<InfiniteData<HotInboxListPage>>;
  return (
    Array.isArray(candidate.pages) &&
    candidate.pages.length > 0 &&
    Array.isArray(candidate.pageParams) &&
    candidate.pageParams.length > 0 &&
    isValidInboxListPage(candidate.pages[0])
  );
}

function newestQueries(queries: DehydratedHotQuery[], limit: number) {
  return queries
    .sort((left, right) => right.state.dataUpdatedAt - left.state.dataUpdatedAt)
    .slice(0, limit);
}

function retainInboxListFirstPage(query: DehydratedHotQuery): DehydratedHotQuery {
  const data = query.state.data as InfiniteData<HotInboxListPage>;

  return {
    ...query,
    state: {
      ...query.state,
      data: {
        ...data,
        pages: [data.pages[0]!],
        pageParams: [data.pageParams[0]],
      },
    },
  };
}

export function prepareHotCacheState(state: DehydratedState): DehydratedState {
  const inboxListQueries = newestQueries(
    state.queries.filter(
      (query) =>
        isInboxQueryScope(query, "items") && isValidInfiniteInboxListData(query.state.data),
    ),
    HOT_CACHE_MAX_INBOX_LISTS,
  ).map(retainInboxListFirstPage);
  const inboxItemDetailQueries = newestQueries(
    state.queries.filter((query) => isInboxQueryScope(query, "item-detail")),
    HOT_CACHE_MAX_ITEM_DETAILS,
  );
  const otherQueries = state.queries.filter(
    (query) => !isInboxQueryScope(query, "items") && !isInboxQueryScope(query, "item-detail"),
  );

  return {
    ...state,
    queries: [...otherQueries, ...inboxListQueries, ...inboxItemDetailQueries],
  };
}

/**
 * Whether a persisted item-detail entry is the `{ item }` response the query returns, holding the
 * article it is keyed by. `item: null` is a valid response (the article is gone).
 */
function isValidItemDetailData(itemId: unknown, data: unknown): boolean {
  if (!data || typeof data !== "object" || !("item" in data)) {
    return false;
  }
  const { item } = data as { item: unknown };
  if (item === null) {
    return true;
  }
  const parsed = articleDetailSchema.safeParse(item);
  return parsed.success && parsed.data.id === itemId;
}

function isCorruptHotQuery(query: DehydratedHotQuery) {
  if (query.state.data === undefined) {
    return false;
  }
  if (isInboxQueryScope(query, "items")) {
    const data = query.state.data;
    if (!data || typeof data !== "object") {
      return true;
    }
    const { pages } = data as Partial<InfiniteData<HotInboxListPage>>;
    return (
      pages !== undefined &&
      (!Array.isArray(pages) || pages.some((page) => !isValidInboxListPage(page)))
    );
  }
  if (isInboxQueryScope(query, "item-detail")) {
    return !isValidItemDetailData(query.queryKey[2], query.state.data);
  }
  return false;
}

/**
 * Drop persisted entries that no longer match what their query returns (an older shape, a
 * mismatched id). It filters the snapshot before it is hydrated, so the live cache, including
 * queries the page is observing right now, is never touched.
 */
export function dropCorruptHotQueries(state: DehydratedState): DehydratedState {
  return { ...state, queries: state.queries.filter((query) => !isCorruptHotQuery(query)) };
}

export function hydrateHotQueryCache(queryClient: QueryClient): Promise<void> {
  if (hasHydrated || typeof window === "undefined") {
    return Promise.resolve();
  }
  hasHydrated = true;

  return readHotCache()
    .then(async (parsed) => {
      removeLegacyLocalStorageCache();
      await removeHotCache(HOT_CACHE_LEGACY_KEY).catch(() => {});
      if (!parsed) {
        return;
      }

      if (!parsed.savedAt || Date.now() - parsed.savedAt > HOT_CACHE_MAX_AGE_MS) {
        await removeHotCache(HOT_CACHE_KEY);
        return;
      }

      hydrate(queryClient, dropCorruptHotQueries(parsed.state));
    })
    .catch(async () => {
      await removeHotCache(HOT_CACHE_KEY).catch(() => {});
    });
}

export async function clearHotQueryCache(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = undefined;
  }

  await pendingPersist;
  removeLegacyLocalStorageCache();
  await Promise.all([
    removeHotCache(HOT_CACHE_KEY).catch(() => {}),
    removeHotCache(HOT_CACHE_LEGACY_KEY).catch(() => {}),
  ]);
}

async function persistHotQueryCache(queryClient: QueryClient) {
  if (pendingPersist) {
    return pendingPersist;
  }

  pendingPersist = Promise.resolve()
    .then(async () => {
      const dehydrated = dehydrate(queryClient, { shouldDehydrateQuery: isSuccessfulHotQuery });
      const state = prepareHotCacheState(dehydrated);
      await writeHotCache({
        savedAt: Date.now(),
        state,
      });
    })
    .catch(async () => {
      await removeHotCache(HOT_CACHE_KEY).catch(() => {});
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
