// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callbacks: {} as Record<string, (metric: { name: string; value: number }) => void>,
  capturePagePerf: vi.fn(),
}));

vi.mock("web-vitals", () => {
  const register =
    (name: string) => (callback: (metric: { name: string; value: number }) => void) => {
      mocks.callbacks[name] = callback;
    };
  return {
    onCLS: register("CLS"),
    onFCP: register("FCP"),
    onINP: register("INP"),
    onLCP: register("LCP"),
    onTTFB: register("TTFB"),
  };
});
vi.mock("@integrations/posthog/capture", () => ({ capturePagePerf: mocks.capturePagePerf }));

function hidePage() {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("startPagePerfReporting", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    performance.clearMarks();
  });

  async function start(routeId: string | undefined = "/_app/inbox") {
    const { startPagePerfReporting } = await import("@integrations/posthog/perf");
    startPagePerfReporting({ getRouteId: () => routeId });
  }

  test("sends one event with the vitals, marks and cache outcome when the page is hidden", async () => {
    performance.mark("kyomi:hydrate-start");
    await start();
    mocks.callbacks.TTFB!({ name: "TTFB", value: 120.4 });
    mocks.callbacks.LCP!({ name: "LCP", value: 1800.6 });
    mocks.callbacks.CLS!({ name: "CLS", value: 0.123456 });

    hidePage();
    hidePage();
    window.dispatchEvent(new Event("pagehide"));

    expect(mocks.capturePagePerf).toHaveBeenCalledTimes(1);
    expect(mocks.capturePagePerf).toHaveBeenCalledWith(
      expect.objectContaining({
        route_id: "/_app/inbox",
        hot_cache: "pending",
        vitals: { TTFB: 120, LCP: 1801, CLS: 0.1235 },
        marks: expect.objectContaining({ "hydrate-start": expect.any(Number) }),
        server_timing: {},
      }),
    );
  });

  test("sends nothing for a page that never produced a vital", async () => {
    await start();

    hidePage();

    expect(mocks.capturePagePerf).not.toHaveBeenCalled();
  });

  test("starts reporting once however many times it is called", async () => {
    const { startPagePerfReporting } = await import("@integrations/posthog/perf");
    startPagePerfReporting({ getRouteId: () => "/a" });
    startPagePerfReporting({ getRouteId: () => "/b" });
    mocks.callbacks.FCP!({ name: "FCP", value: 500 });

    hidePage();

    expect(mocks.capturePagePerf).toHaveBeenCalledTimes(1);
    expect(mocks.capturePagePerf).toHaveBeenCalledWith(expect.objectContaining({ route_id: "/a" }));
  });
});
