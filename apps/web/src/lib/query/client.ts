import { QueryClient } from "@tanstack/react-query";
import { hydrateHotQueryCache } from "./cache-persistence";

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
