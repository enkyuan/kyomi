import type { DehydratedState, QueryClient } from "@tanstack/react-query";
import { hydrate as queryHydrate } from "@tanstack/react-query";

/**
 * The dehydrated state shape produced by @tanstack/react-router-ssr-query's
 * server-side dehydrate(): a standard TanStack Query dehydrated client
 * (optional) plus a ReadableStream of incrementally-dehydrated query snapshots.
 */
type SsrDehydratedState = {
  dehydratedQueryClient?: DehydratedState;
  queryStream?: {
    getReader: () => {
      read: () => Promise<{ done: boolean; value?: DehydratedState }>;
    };
  };
};

/**
 * Creates a corrected `router.options.hydrate` function that replaces the one
 * installed by @tanstack/react-router-ssr-query, which has a bug where
 * `queryHydrate()` is called *before* checking the stream's `done` flag.
 *
 * When the ReadableStream ends, `reader.read()` returns `{ done: true,
 * value: undefined }`. The upstream code passes that `undefined` to
 * `queryHydrate()`, which then tries to read `undefined.mutations`, throwing
 * `TypeError: Cannot read properties of undefined (reading 'mutations')`.
 *
 * This implementation checks `done` first and only hydrates valid chunks.
 *
 * @param ogHydrate  The original router.options.hydrate captured before the SSR
 *                   query integration replaced it (usually undefined).
 * @param queryClient The shared TanStack QueryClient instance.
 */
export function createSafeHydrate(
  ogHydrate: ((dehydrated: unknown) => Promise<void> | void) | undefined,
  queryClient: QueryClient,
) {
  return async (dehydrated: unknown) => {
    await ogHydrate?.(dehydrated as never);

    const state = dehydrated as SsrDehydratedState | undefined;
    if (state?.dehydratedQueryClient) {
      queryHydrate(queryClient, state.dehydratedQueryClient);
    }

    if (state?.queryStream) {
      const reader = state.queryStream.getReader();
      let result;
      do {
        result = await reader.read();
        if (!result.done && result.value) {
          queryHydrate(queryClient, result.value);
        }
      } while (!result.done);
    }
  };
}
