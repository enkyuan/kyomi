// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hydrateHotQueryCache: vi.fn(),
  subscribeHotQueryCachePersistence: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@lib/query/cache", () => ({
  hydrateHotQueryCache: mocks.hydrateHotQueryCache,
  subscribeHotQueryCachePersistence: mocks.subscribeHotQueryCachePersistence,
}));

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe("TanstackQueryProvider", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("defers hot query cache hydration until after the provider mounts", async () => {
    const hydration = createDeferred();
    mocks.hydrateHotQueryCache.mockReturnValue(hydration.promise);
    mocks.subscribeHotQueryCachePersistence.mockReturnValue(mocks.unsubscribe);

    const { default: TanstackQueryProvider } =
      await import("../../../../../../apps/web/src/integrations/tanstack-query/provider");

    expect(mocks.hydrateHotQueryCache).not.toHaveBeenCalled();

    render(
      <TanstackQueryProvider>
        <div>Query provider ready</div>
      </TanstackQueryProvider>,
    );

    expect(screen.getByText("Query provider ready")).toBeTruthy();
    await waitFor(() => {
      expect(mocks.hydrateHotQueryCache).toHaveBeenCalledTimes(1);
    });
    expect(mocks.subscribeHotQueryCachePersistence).not.toHaveBeenCalled();

    await act(async () => {
      hydration.resolve();
      await hydration.promise;
    });

    await waitFor(() => {
      expect(mocks.subscribeHotQueryCachePersistence).toHaveBeenCalledTimes(1);
    });
  });
});
