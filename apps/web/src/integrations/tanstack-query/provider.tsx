"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  clearHotQueryCache,
  hydrateHotQueryCache,
  subscribeHotQueryCachePersistence,
} from "@lib/query/cache";

export default function TanstackQueryProvider({
  children,
  queryClient,
  sessionStatus,
}: {
  children: ReactNode;
  queryClient: QueryClient;
  sessionStatus?: "authenticated" | "anonymous";
}) {
  useEffect(() => {
    if (!sessionStatus) {
      return;
    }

    if (sessionStatus === "anonymous") {
      queryClient.clear();
      void clearHotQueryCache();
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void hydrateHotQueryCache(queryClient).finally(() => {
      if (cancelled) {
        return;
      }
      unsubscribe = subscribeHotQueryCachePersistence(queryClient);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient, sessionStatus]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
