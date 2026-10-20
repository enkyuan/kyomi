import posthog from "posthog-js";

/** Reports an error caught by a route boundary. A no-op on the server or without a PostHog key. */
export function captureRouteError(error: unknown) {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.captureException(error instanceof Error ? error : new Error(String(error)));
}
