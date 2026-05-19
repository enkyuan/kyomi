import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import { dehydrate, hydrate } from "@tanstack/react-query";
import type { InboxListPage } from "@modules/inbox";

const HOT_CACHE_KEY = "vols.rss:hot-query-cache:v1";
const HOT_CACHE_MAX_AGE_MS = 10 * 60_000;
const PERSIST_THROTTLE_MS = 1_000;

type PersistedHotCache = {
  savedAt: number;
  state: unknown;
};

let hasHydrated = false;
let persistTimer: number | undefined;

function isHotQueryKey(queryKey: QueryKey) {
  const [family, scope] = queryKey;
  return (
    (family === "inbox" && scope === "items") || (family === "sidebar" && scope === "inbox-summary")
  );
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

export function hydrateHotQueryCache(queryClient: QueryClient) {
  if (hasHydrated || typeof window === "undefined") {
    return;
  }
  hasHydrated = true;

  window.setTimeout(() => {
    try {
      const raw = window.localStorage.getItem(HOT_CACHE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as PersistedHotCache;
      if (!parsed.savedAt || Date.now() - parsed.savedAt > HOT_CACHE_MAX_AGE_MS) {
        window.localStorage.removeItem(HOT_CACHE_KEY);
        return;
      }

      hydrate(queryClient, parsed.state);
      dropCorruptInboxItemQueries(queryClient);
    } catch {
      window.localStorage.removeItem(HOT_CACHE_KEY);
    }
  }, 0);
}

export function subscribeHotQueryCachePersistence(queryClient: QueryClient) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    if (persistTimer) {
      return;
    }

    persistTimer = window.setTimeout(() => {
      persistTimer = undefined;

      try {
        const state = dehydrate(queryClient, {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" && isHotQueryKey(query.queryKey),
        });
        window.localStorage.setItem(
          HOT_CACHE_KEY,
          JSON.stringify({
            savedAt: Date.now(),
            state,
          } satisfies PersistedHotCache),
        );
      } catch {
        window.localStorage.removeItem(HOT_CACHE_KEY);
      }
    }, PERSIST_THROTTLE_MS);
  });

  return () => {
    unsubscribe();
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = undefined;
    }
  };
}
