import type { DehydratedState, QueryClient } from "@tanstack/react-query";
import { hydrate as queryHydrate } from "@tanstack/react-query";
import { mark } from "@lib/perf/marks";

type QueryBatch = DehydratedState["queries"];
type QueryStreamReader = {
  releaseLock?: () => void;
  read: () => Promise<{ done: boolean; value?: DehydratedState | QueryBatch }>;
};

// The installed SSR integration sends initial and streamed arrays of queries. Accept
// snapshots from the preceding wire format during a rolling web deployment as well.
type SsrDehydratedState = {
  query?: { initial?: QueryBatch; stream?: { getReader: () => QueryStreamReader } };
  dehydratedQueryClient?: DehydratedState;
  queryStream?: { getReader: () => QueryStreamReader };
};

/** Restore initial data before mounting, and drain incremental batches without blocking paint. */
export function createSafeHydrate(
  ogHydrate: ((dehydrated: unknown) => Promise<void> | void) | undefined,
  queryClient: QueryClient,
) {
  return async (dehydrated: unknown) => {
    mark("router-hydrate-start");
    await ogHydrate?.(dehydrated as never);

    const state = dehydrated as SsrDehydratedState | undefined;
    const initial = state?.query?.initial
      ? { queries: state.query.initial, mutations: [] }
      : state?.dehydratedQueryClient;
    if (initial) {
      queryHydrate(queryClient, initial);
    }

    const stream = state?.query?.stream ?? state?.queryStream;
    if (stream) {
      // Not awaited: the stream closes only when the server has finished the whole response, and
      // router hydration (so `hydrateRoot`) must not wait for that.
      void drainQueryStream(stream.getReader(), queryClient);
    }
    mark("router-hydrate-end");
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
        hydrateStreamedChunk(
          queryClient,
          Array.isArray(result.value) ? { queries: result.value, mutations: [] } : result.value,
        );
      }
    } while (!result.done);
  } catch (error) {
    console.error("Error reading the query stream:", error);
  } finally {
    reader.releaseLock?.();
    mark("query-stream-drained");
  }
}

function hydrateStreamedChunk(queryClient: QueryClient, chunk: Parameters<typeof queryHydrate>[1]) {
  try {
    queryHydrate(queryClient, chunk);
  } catch (error) {
    console.error("Error hydrating a streamed query chunk:", error);
  }
}
