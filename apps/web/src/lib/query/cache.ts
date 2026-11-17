import type { DehydratedState, InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import { dehydrate, hydrate } from "@tanstack/react-query";
import { queryKeys } from "./keys";

const HOT_CACHE_KEY = "kyomi:hot-query-cache:v2";
/** Removed on load (from localStorage and IndexedDB) if an older build left it behind. */
const HOT_CACHE_LEGACY_KEY = "kyomi:hot-query-cache:v1";
/** Bump when the data shape of a persisted query changes: older snapshots are discarded unread. */
const HOT_CACHE_SCHEMA = 3;
const HOT_CACHE_DB_NAME = "kyomi.query-cache";
const HOT_CACHE_STORE_NAME = "snapshots";
const HOT_CACHE_DB_VERSION = 1;
const HOT_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;
const PERSIST_THROTTLE_MS = 1_000;
const PERSIST_IDLE_TIMEOUT_MS = 2_000;
/** Consecutive failed writes after which persisting stops until the next sign-in or page load. */
const PERSIST_FAILURE_LIMIT = 3;
/** Logout must never wait on a stuck IndexedDB operation longer than this. */
const CLEAR_TIMEOUT_MS = 1_000;
const HOT_CACHE_MAX_INBOX_LISTS = 8;

/** The hot cache only relies on a persisted inbox list page carrying an `items` array. */
type HotInboxListPage = { items: unknown[] };

/**
 * One snapshot per browser. It carries the user it belongs to, so a different account never hydrates
 * it, and the schema version it was written with.
 */
type PersistedHotCache = {
  savedAt: number;
  schema: number;
  userId: string;
  state: DehydratedState;
};

let hasHydrated = false;
let persistTimer: number | undefined;
let pendingPersist: Promise<void> | undefined;
/** Which queries (and when they last changed) the stored snapshot holds; an equal one is not rewritten. */
let lastWrittenSignature: string | undefined;
let consecutiveFailures = 0;
let persistDisabled = false;

/**
 * Article details are deliberately absent: each holds the full article body, the heaviest thing to
 * clone on the main thread, and it should not sit on disk for a day. Opening an article fetches it;
 * the list rows paint instantly from this snapshot.
 */
const HOT_QUERY_KEY_PREFIXES: readonly QueryKey[] = [
  queryKeys.folders.all,
  queryKeys.feeds.followed,
  queryKeys.inbox.items,
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

function isInboxListQuery(query: DehydratedHotQuery) {
  return hasQueryKeyPrefix(query.queryKey, queryKeys.inbox.items);
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
      (query) => isInboxListQuery(query) && isValidInfiniteInboxListData(query.state.data),
    ),
    HOT_CACHE_MAX_INBOX_LISTS,
  ).map(retainInboxListFirstPage);
  const otherQueries = state.queries.filter((query) => !isInboxListQuery(query));

  return { ...state, queries: [...otherQueries, ...inboxListQueries] };
}

function isCorruptHotQuery(query: DehydratedHotQuery) {
  if (!isInboxListQuery(query) || query.state.data === undefined) {
    return false;
  }
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

/**
 * Drop persisted entries that no longer match what their query returns (an older shape). It filters the snapshot before it is hydrated, so the live cache, including
 * queries the page is observing right now, is never touched.
 */
export function dropCorruptHotQueries(state: DehydratedState): DehydratedState {
  return { ...state, queries: state.queries.filter((query) => !isCorruptHotQuery(query)) };
}

/** `promise`, or `undefined` pending, settled within `ms`: a stuck IndexedDB call cannot block a caller. */
function settleWithin(promise: Promise<unknown> | undefined, ms: number) {
  return Promise.race([
    promise ?? Promise.resolve(),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

/**
 * Restore the snapshot into the query cache, once per page. A snapshot written for another user,
 * by another schema version, or more than a day ago is discarded unread.
 */
export function hydrateHotQueryCache(queryClient: QueryClient, userId: string): Promise<void> {
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

      const isCurrent =
        parsed.schema === HOT_CACHE_SCHEMA &&
        parsed.userId === userId &&
        Boolean(parsed.savedAt) &&
        Date.now() - parsed.savedAt <= HOT_CACHE_MAX_AGE_MS;
      if (!isCurrent) {
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
  lastWrittenSignature = undefined;
  consecutiveFailures = 0;
  persistDisabled = false;

  await settleWithin(pendingPersist, CLEAR_TIMEOUT_MS);
  removeLegacyLocalStorageCache();
  await settleWithin(
    Promise.all([
      removeHotCache(HOT_CACHE_KEY).catch(() => {}),
      removeHotCache(HOT_CACHE_LEGACY_KEY).catch(() => {}),
    ]),
    CLEAR_TIMEOUT_MS,
  );
}

function snapshotSignature(state: DehydratedState) {
  return state.queries
    .map((query) => `${query.queryHash}:${query.state.dataUpdatedAt}`)
    .sort()
    .join("|");
}

/** A full or disabled store will not recover by retrying. */
function isStorageLimitError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "DataCloneError")
  );
}

async function persistHotQueryCache(queryClient: QueryClient, userId: string) {
  if (pendingPersist) {
    return pendingPersist;
  }

  pendingPersist = Promise.resolve()
    .then(async () => {
      const dehydrated = dehydrate(queryClient, { shouldDehydrateQuery: isSuccessfulHotQuery });
      const state = prepareHotCacheState(dehydrated);
      const signature = snapshotSignature(state);
      if (signature === lastWrittenSignature) {
        return;
      }
      await writeHotCache({ savedAt: Date.now(), schema: HOT_CACHE_SCHEMA, userId, state });
      lastWrittenSignature = signature;
      consecutiveFailures = 0;
    })
    .catch((error: unknown) => {
      // The last good snapshot stays: a failed write says nothing about it.
      consecutiveFailures += 1;
      if (consecutiveFailures >= PERSIST_FAILURE_LIMIT || isStorageLimitError(error)) {
        persistDisabled = true;
      }
    })
    .finally(() => {
      pendingPersist = undefined;
    });

  return pendingPersist;
}

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
};

function runWhenIdle(task: () => void) {
  const { requestIdleCallback } = window as IdleWindow;
  if (requestIdleCallback) {
    requestIdleCallback.call(window, task, { timeout: PERSIST_IDLE_TIMEOUT_MS });
    return;
  }
  task();
}

function scheduleHotCachePersist(queryClient: QueryClient, userId: string) {
  if (persistTimer || persistDisabled) {
    return;
  }

  persistTimer = window.setTimeout(() => {
    persistTimer = undefined;
    runWhenIdle(() => void persistHotQueryCache(queryClient, userId));
  }, PERSIST_THROTTLE_MS);
}

type CacheEventLike = {
  type?: string;
  query?: { queryKey?: QueryKey };
  action?: { type?: string };
};

/** Only a hot query gaining data or leaving the cache changes the snapshot. */
function shouldPersistQueryCacheEvent(event: unknown) {
  if (!event || typeof event !== "object") {
    return false;
  }

  const { type, query, action } = event as CacheEventLike;
  if (!query?.queryKey || !isHotQueryKey(query.queryKey)) {
    return false;
  }
  return (
    type === "removed" ||
    (type === "updated" && (action?.type === "success" || action?.type === "setState"))
  );
}

export function subscribeHotQueryCachePersistence(queryClient: QueryClient, userId: string) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (!shouldPersistQueryCacheEvent(event)) {
      return;
    }
    scheduleHotCachePersist(queryClient, userId);
  });

  return () => {
    unsubscribe();
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = undefined;
    }
  };
}
