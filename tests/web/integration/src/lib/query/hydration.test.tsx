// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    hydrate: vi.fn((_client: unknown, _state: unknown) => undefined),
  };
});

function createMockReader(chunks: unknown[]) {
  let index = 0;
  return {
    read: vi.fn(async () => {
      if (index < chunks.length) {
        return { done: false, value: chunks[index++] };
      }
      return { done: true, value: undefined };
    }),
  };
}

function mockQueryClient() {
  return { getDefaultOptions: () => ({}) };
}

describe("createSafeHydrate stream reading", () => {
  let queryHydrate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const rq = await import("@tanstack/react-query");
    queryHydrate = rq.hydrate as unknown as ReturnType<typeof vi.fn>;
    queryHydrate.mockClear();
  });

  test("restores the current router's initial query array and streamed batches", async () => {
    const { createSafeHydrate } = await import("@lib/query/hydration");
    const qc = mockQueryClient();
    const initial = [{ queryHash: "initial" }];
    const later = [{ queryHash: "later" }];
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(later);
        controller.close();
      },
    });
    await createSafeHydrate(
      undefined,
      qc as unknown as QueryClient,
    )({ query: { initial, stream } });
    await vi.waitFor(() =>
      expect(queryHydrate).toHaveBeenCalledWith(qc, { queries: later, mutations: [] }),
    );
    expect(queryHydrate).toHaveBeenCalledWith(qc, { queries: initial, mutations: [] });
    expect(stream.locked).toBe(false);
  });

  test("does not call queryHydrate with undefined when the stream ends", async () => {
    const { createSafeHydrate } = await import("@lib/query/hydration");
    const chunk1 = { queries: [{ queryHash: "a" }], mutations: [] };
    const reader = createMockReader([chunk1]);
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    await hydrate({
      dehydratedQueryClient: undefined,
      queryStream: { getReader: () => reader },
    });

    await vi.waitFor(() => expect(reader.read).toHaveBeenCalledTimes(2));
    expect(queryHydrate).toHaveBeenCalledWith(qc, chunk1);
    expect(queryHydrate).not.toHaveBeenCalledWith(qc, undefined);
  });

  test("hydrates all chunks then stops cleanly at end-of-stream", async () => {
    const { createSafeHydrate } = await import("@lib/query/hydration");
    const chunk1 = { queries: [{ queryHash: "a" }], mutations: [] };
    const chunk2 = { queries: [{ queryHash: "b" }], mutations: [] };
    const reader = createMockReader([chunk1, chunk2]);
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    await hydrate({
      dehydratedQueryClient: undefined,
      queryStream: { getReader: () => reader },
    });

    await vi.waitFor(() => expect(reader.read).toHaveBeenCalledTimes(3));
    expect(queryHydrate).toHaveBeenCalledWith(qc, chunk1);
    expect(queryHydrate).toHaveBeenCalledWith(qc, chunk2);
    expect(queryHydrate).not.toHaveBeenCalledWith(qc, undefined);
  });

  test("does not wait for the stream to close, so router hydration is not gated on it", async () => {
    const { createSafeHydrate } = await import("@lib/query/hydration");
    const dehydratedQueryClient = { queries: [{ queryHash: "first" }], mutations: [] };
    const later = { queries: [{ queryHash: "later" }], mutations: [] };
    let closeStream = () => {};
    let chunks = 0;
    const reader = {
      read: vi.fn(
        () =>
          new Promise<{ done: boolean; value?: unknown }>((resolve) => {
            if (chunks === 0) {
              chunks += 1;
              resolve({ done: false, value: later });
              return;
            }
            closeStream = () => resolve({ done: true, value: undefined });
          }),
      ),
    };
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    // The stream stays open, yet hydrate settles with the first payload already applied.
    await hydrate({ dehydratedQueryClient, queryStream: { getReader: () => reader } });

    expect(queryHydrate).toHaveBeenCalledWith(qc, dehydratedQueryClient);
    await vi.waitFor(() => expect(queryHydrate).toHaveBeenCalledWith(qc, later));
    closeStream();
  });

  test("one chunk that fails to hydrate does not stop the chunks after it", async () => {
    const { createSafeHydrate } = await import("@lib/query/hydration");
    const bad = { queries: [{ queryHash: "bad" }], mutations: [] };
    const good = { queries: [{ queryHash: "good" }], mutations: [] };
    const reader = createMockReader([bad, good]);
    const qc = mockQueryClient();
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    queryHydrate.mockImplementationOnce(() => {
      throw new Error("malformed chunk");
    });

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    await hydrate({ dehydratedQueryClient: undefined, queryStream: { getReader: () => reader } });

    await vi.waitFor(() => expect(queryHydrate).toHaveBeenCalledWith(qc, good));
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  test("a stream that errors leaves the rest to the client instead of failing hydration", async () => {
    const { createSafeHydrate } = await import("@lib/query/hydration");
    const reader = {
      read: vi.fn(async () => {
        throw new Error("stream reset");
      }),
    };
    const qc = mockQueryClient();
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    await expect(
      hydrate({ dehydratedQueryClient: undefined, queryStream: { getReader: () => reader } }),
    ).resolves.toBeUndefined();

    await vi.waitFor(() => expect(reader.read).toHaveBeenCalledTimes(1));
    expect(queryHydrate).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  test("hydrates dehydratedQueryClient when no queryStream is present", async () => {
    const { createSafeHydrate } = await import("@lib/query/hydration");
    const dehydratedQueryClient = { queries: [{ queryHash: "x" }], mutations: [] };
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    await hydrate({ dehydratedQueryClient });

    expect(queryHydrate).toHaveBeenCalledWith(qc, dehydratedQueryClient);
  });

  test("handles an empty queryStream gracefully (done on first read)", async () => {
    const { createSafeHydrate } = await import("@lib/query/hydration");
    const reader = createMockReader([]);
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    await expect(
      hydrate({
        dehydratedQueryClient: undefined,
        queryStream: { getReader: () => reader },
      }),
    ).resolves.toBeUndefined();

    expect(queryHydrate).not.toHaveBeenCalled();
  });

  test("calls ogHydrate when provided", async () => {
    const { createSafeHydrate } = await import("@lib/query/hydration");
    const ogHydrate = vi.fn(async (_d: unknown) => {});
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(ogHydrate, qc as unknown as QueryClient);
    const dehydrated = { some: "data" };

    await hydrate(dehydrated);
    expect(ogHydrate).toHaveBeenCalledWith(dehydrated);
  });
});
