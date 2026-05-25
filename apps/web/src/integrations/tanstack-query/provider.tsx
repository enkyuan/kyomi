"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { subscribeHotQueryCachePersistence } from "@lib/query/cache-persistence";

import { hotQueryCacheHydration, queryClient } from "@lib/query/client";

export default function TanstackQueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void hotQueryCacheHydration.finally(() => {
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
