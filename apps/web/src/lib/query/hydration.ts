import type { DehydratedState, QueryClient } from "@tanstack/react-query";
import { hydrate as queryHydrate } from "@tanstack/react-query";

type QueryStreamReader = {
  read: () => Promise<{ done: boolean; value?: DehydratedState }>;
};

/**
 * The dehydrated state shape produced by @tanstack/react-router-ssr-query's
 * server-side dehydrate(): a standard TanStack Query dehydrated client
 * (optional) plus a ReadableStream of incrementally-dehydrated query snapshots.
 */
type SsrDehydratedState = {
  dehydratedQueryClient?: DehydratedState;
  queryStream?: { getReader: () => QueryStreamReader };
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
 * This implementation checks `done` first and only hydrates valid chunks. It also does not wait
 * for the stream to close: the dehydrated query client is hydrated before the router mounts and
 * the rest of the stream is drained in the background, as the upstream integration does.
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
      // Not awaited: the stream closes only when the server has finished the whole response, and
      // router hydration (so `hydrateRoot`) must not wait for that.
      void drainQueryStream(state.queryStream.getReader(), queryClient);
    }
  };
}

/**
 * Hydrate each chunk as it arrives until the stream ends. A bad chunk or a broken stream only
 * means the queries it would have carried are fetched by the client instead, so each failure is
 * logged and never rejects hydration; one bad chunk does not stop the ones after it.
 */
async function drainQueryStream(reader: QueryStreamReader, queryClient: QueryClient) {
  try {
    let result;
    do {
      result = await reader.read();
      if (!result.done && result.value) {
        try {
          queryHydrate(queryClient, result.value);
        } catch (error) {
          console.error("Error hydrating a streamed query chunk:", error);
        }
      }
    } while (!result.done);
  } catch (error) {
    console.error("Error reading the query stream:", error);
  }
}
