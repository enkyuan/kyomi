import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { dehydrate, hydrate } from "@tanstack/react-query";

const HOT_CACHE_KEY = "cronos:hot-query-cache:v1";
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

export function hydrateHotQueryCache(queryClient: QueryClient) {
  if (hasHydrated || typeof window === "undefined") {
    return;
  }
  hasHydrated = true;

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
  } catch {
    window.localStorage.removeItem(HOT_CACHE_KEY);
  }
}

export function subscribeHotQueryCachePersistence(queryClient: QueryClient) {
  if (typeof window === "undefined") {
    return () => {};
  }

  return queryClient.getQueryCache().subscribe(() => {
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
}
