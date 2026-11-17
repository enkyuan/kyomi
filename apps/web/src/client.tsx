import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { captureHydrationError } from "@integrations/posthog/capture";
import { mark } from "@lib/perf/marks";

// The framework's default client entry, plus a mark when hydration starts and a report of the errors
// React recovers from by discarding the server markup and rendering on the client, which would
// otherwise only show as a flash and a warning in the console.
mark("hydrate-start");

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
    {
      onRecoverableError: (error, errorInfo) => {
        console.error("React recovered from an error while hydrating:", error);
        captureHydrationError(error, errorInfo.componentStack);
      },
    },
  );
});
