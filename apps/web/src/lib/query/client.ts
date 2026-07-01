import { QueryClient } from "@tanstack/react-query";
import { hydrateHotQueryCache } from "@lib/query/cache";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});

export const hotQueryCacheHydration = hydrateHotQueryCache(queryClient);

export function getContext() {
  return {
    queryClient,
  };
}
