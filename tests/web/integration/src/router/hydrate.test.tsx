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

  test("does not call queryHydrate with undefined when the stream ends", async () => {
    const { createSafeHydrate } = await import("@/lib/ssr-query-hydration");
    const chunk1 = { queries: [{ queryHash: "a" }], mutations: [] };
    const reader = createMockReader([chunk1]);
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    await hydrate({
      dehydratedQueryClient: undefined,
      queryStream: { getReader: () => reader },
    });

    expect(queryHydrate).toHaveBeenCalledWith(qc, chunk1);
    expect(queryHydrate).not.toHaveBeenCalledWith(qc, undefined);
  });

  test("hydrates all chunks then stops cleanly at end-of-stream", async () => {
    const { createSafeHydrate } = await import("@/lib/ssr-query-hydration");
    const chunk1 = { queries: [{ queryHash: "a" }], mutations: [] };
    const chunk2 = { queries: [{ queryHash: "b" }], mutations: [] };
    const reader = createMockReader([chunk1, chunk2]);
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    await hydrate({
      dehydratedQueryClient: undefined,
      queryStream: { getReader: () => reader },
    });

    expect(queryHydrate).toHaveBeenCalledWith(qc, chunk1);
    expect(queryHydrate).toHaveBeenCalledWith(qc, chunk2);
    expect(queryHydrate).not.toHaveBeenCalledWith(qc, undefined);
    expect(reader.read).toHaveBeenCalledTimes(3);
  });

  test("hydrates dehydratedQueryClient when no queryStream is present", async () => {
    const { createSafeHydrate } = await import("@/lib/ssr-query-hydration");
    const dehydratedQueryClient = { queries: [{ queryHash: "x" }], mutations: [] };
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(undefined, qc as unknown as QueryClient);
    await hydrate({ dehydratedQueryClient });

    expect(queryHydrate).toHaveBeenCalledWith(qc, dehydratedQueryClient);
  });

  test("handles an empty queryStream gracefully (done on first read)", async () => {
    const { createSafeHydrate } = await import("@/lib/ssr-query-hydration");
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
    const { createSafeHydrate } = await import("@/lib/ssr-query-hydration");
    const ogHydrate = vi.fn(async (_d: unknown) => {});
    const qc = mockQueryClient();

    const hydrate = createSafeHydrate(ogHydrate, qc as unknown as QueryClient);
    const dehydrated = { some: "data" };

    await hydrate(dehydrated);
    expect(ogHydrate).toHaveBeenCalledWith(dehydrated);
  });
});
