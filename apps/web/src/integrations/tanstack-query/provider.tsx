"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  clearHotQueryCache,
  hydrateHotQueryCache,
  subscribeHotQueryCachePersistence,
} from "@lib/query/cache";

import { queryClient } from "@lib/query/client";

export default function TanstackQueryProvider({
  children,
  sessionStatus,
}: {
  children: ReactNode;
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
  }, [sessionStatus]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
