"use client";

import { useEffect, useRef } from "react";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toastManager } from "@kyomi/ui/components/toast";
import { useAuth } from "@integrations/better-auth/provider";
import { clearHotQueryCache } from "@lib/query/cache";
import { prefetchInboxFlow } from "@modules/inbox/lib/navigation";

const SERVICE_WORKER_URL = "/sw.js";
const OFFLINE_TOAST_ID = "network-offline";

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
  const previousIsAuthenticated = useRef(isAuthenticated);

  useEffect(() => {
    // Only transitions toast: starting online (or offline) stays silent. The offline toast is
    // persistent and replaced in place so a flapping connection never stacks toasts.
    return onlineManager.subscribe((isOnline) => {
      if (!isOnline) {
        toastManager.add({
          id: OFFLINE_TOAST_ID,
          title: "You're offline",
          description: "Changes won't save until you reconnect.",
          timeout: 0,
          type: "warning",
        });
        return;
      }
      toastManager.close(OFFLINE_TOAST_ID);
      toastManager.add({ title: "Back online", timeout: 2000, type: "success" });
    });
  }, []);

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

    const wasAuthenticated = previousIsAuthenticated.current;
    previousIsAuthenticated.current = isAuthenticated;
    if (!wasAuthenticated || isAuthenticated) {
      return;
    }

    queryClient.clear();
    void (async () => {
      try {
        await clearHotQueryCache();
      } finally {
        await router.invalidate();
      }
    })().catch(() => {});
  }, [isAuthenticated, isPending, queryClient, router]);

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
