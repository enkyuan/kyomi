"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  hydrateHotQueryCache,
  subscribeHotQueryCachePersistence,
} from "@integrations/tanstack-query/hot-cache-persistence";

import { queryClient } from "./client";

export default function TanstackQueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    hydrateHotQueryCache(queryClient);
    return subscribeHotQueryCachePersistence(queryClient);
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
