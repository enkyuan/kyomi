import posthog from "posthog-js";

/** Reports an error caught by a route boundary. A no-op on the server or without a PostHog key. */
export function captureRouteError(error: unknown) {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.captureException(error instanceof Error ? error : new Error(String(error)));
}

/** Reports an error React recovered from by re-rendering on the client instead of hydrating. */
export function captureHydrationError(error: unknown, componentStack?: string) {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.captureException(error instanceof Error ? error : new Error(String(error)), {
    kyomi_hydration_recovery: true,
    component_stack: componentStack,
  });
}

/** One event per page lifecycle with its vitals, marks and server timing. */
export function capturePagePerf(properties: Record<string, unknown>) {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.capture("kyomi_page_perf", properties, { transport: "sendBeacon" });
}
