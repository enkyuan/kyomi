import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AppRuntimeEffects } from "@/app/runtime-effects";

const mocks = vi.hoisted(() => ({
  authState: { isAuthenticated: true, isPending: false },
  clearHotQueryCache: vi.fn(() => Promise.resolve()),
  prefetchInboxFlow: vi.fn(),
  router: {
    invalidate: vi.fn(() => Promise.resolve()),
    preloadRoute: vi.fn(),
    state: {
      location: { href: "/inbox/article?filter=saved", pathname: "/inbox/article" },
      matches: [{ routeId: "/_app" }],
    },
  },
}));

let queryClient: QueryClient;
let clearQueryClient: ReturnType<typeof vi.spyOn>;

vi.mock("@integrations/better-auth/provider", () => ({
  useAuth: () => mocks.authState,
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@modules/inbox", () => ({
  prefetchInboxFlow: mocks.prefetchInboxFlow,
}));

vi.mock("@lib/query/cache", () => ({
  clearHotQueryCache: mocks.clearHotQueryCache,
}));

beforeEach(() => {
  vi.useFakeTimers();
  queryClient = new QueryClient();
  clearQueryClient = vi.spyOn(queryClient, "clear");
  Object.assign(mocks.authState, { isAuthenticated: true, isPending: false });
  mocks.router.state.matches = [{ routeId: "/_app" }];
  mocks.clearHotQueryCache.mockClear();
  mocks.router.invalidate.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AppRuntimeEffects auth recovery", () => {
  test("clears user caches and revalidates a protected route after session expiry", async () => {
    const view = render(
      <QueryClientProvider client={queryClient}>
        <AppRuntimeEffects />
      </QueryClientProvider>,
    );

    Object.assign(mocks.authState, { isAuthenticated: false, isPending: false });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <AppRuntimeEffects />
      </QueryClientProvider>,
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(clearQueryClient).toHaveBeenCalledOnce();
    expect(mocks.clearHotQueryCache).toHaveBeenCalledOnce();
    expect(mocks.router.invalidate).toHaveBeenCalledOnce();
  });

  test("does not redirect an initially anonymous user", async () => {
    Object.assign(mocks.authState, { isAuthenticated: false, isPending: false });

    render(
      <QueryClientProvider client={queryClient}>
        <AppRuntimeEffects />
      </QueryClientProvider>,
    );
    await act(async () => Promise.resolve());

    expect(clearQueryClient).not.toHaveBeenCalled();
    expect(mocks.router.invalidate).not.toHaveBeenCalled();
  });

  test("refreshes public route auth state without forcing protected navigation", async () => {
    mocks.router.state.matches = [{ routeId: "/mcp" }];
    const view = render(
      <QueryClientProvider client={queryClient}>
        <AppRuntimeEffects />
      </QueryClientProvider>,
    );

    Object.assign(mocks.authState, { isAuthenticated: false, isPending: false });
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <AppRuntimeEffects />
      </QueryClientProvider>,
    );
    await act(async () => Promise.resolve());

    expect(clearQueryClient).toHaveBeenCalledOnce();
    expect(mocks.clearHotQueryCache).toHaveBeenCalledOnce();
    expect(mocks.router.invalidate).toHaveBeenCalledOnce();
  });
});
