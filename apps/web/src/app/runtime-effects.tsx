"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@integrations/better-auth/provider";
import { prefetchInboxFlow } from "@modules/inbox";

const SERVICE_WORKER_URL = "/sw.js";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleIdleTask(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const idleWindow = window as IdleWindow;
  if (idleWindow.requestIdleCallback && idleWindow.cancelIdleCallback) {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 3_000 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, 1_200);
  return () => window.clearTimeout(handle);
}

export function AppRuntimeEffects() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, isPending } = useAuth();

  useEffect(() => {
    if (import.meta.env.DEV || !("serviceWorker" in navigator)) {
      return;
    }

    return scheduleIdleTask(() => {
      void navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
    });
  }, []);

  useEffect(() => {
    if (isPending) {
      return;
    }

    return scheduleIdleTask(() => {
      if (isAuthenticated) {
        void prefetchInboxFlow(router, queryClient);
        return;
      }

      void router.preloadRoute({ to: "/", search: {} });
      void router.preloadRoute({ to: "/register", search: {} });
    });
  }, [isAuthenticated, isPending, queryClient, router]);

  return null;
}
