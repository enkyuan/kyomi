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
  userId,
}: {
  children: ReactNode;
  queryClient: QueryClient;
  sessionStatus?: "authenticated" | "anonymous";
  /** Whose data the persisted snapshot may hold; without it nothing is restored or saved. */
  userId?: string;
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

    if (!userId) {
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void hydrateHotQueryCache(queryClient, userId).finally(() => {
      if (cancelled) {
        return;
      }
      unsubscribe = subscribeHotQueryCachePersistence(queryClient, userId);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient, sessionStatus, userId]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
