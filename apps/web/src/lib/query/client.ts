import { QueryClient } from "@tanstack/react-query";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: true,
        refetchOnReconnect: true,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Server renders share no cache: each request gets its own client so queries
 * from one request cannot be cancelled or dehydrated into another. The browser
 * keeps a single client for the lifetime of the page.
 */
export function getContext() {
  if (typeof window === "undefined") {
    return { queryClient: createQueryClient() };
  }

  browserQueryClient ??= createQueryClient();
  return { queryClient: browserQueryClient };
}
