"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { hydrateHotQueryCache, subscribeHotQueryCachePersistence } from "@lib/query/cache";

import { queryClient } from "@lib/query/client";

export default function TanstackQueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
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
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
