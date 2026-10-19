"use client";

import type { PointerEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { prefetchInboxFlow } from "@modules/inbox/lib/navigation";

export function useInboxPrefetch() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const prefetchFeed = (feedId: string) => {
    void prefetchInboxFlow(router, queryClient, { filter: "all", feedId });
  };

  const prefetchOnFocus = (feedId: string) => () => {
    prefetchFeed(feedId);
  };

  const prefetchOnPointerEnter = (feedId: string) => (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      prefetchFeed(feedId);
    }
  };

  return {
    prefetchFeed,
    prefetchOnFocus,
    prefetchOnPointerEnter,
  };
}
