"use client";

import { useEffect, useRef, useState } from "react";
import { useFeedRefresh } from "@hooks/use-feed-refresh";
import { cn } from "@lib/utils";
import {
  getRefreshSummaryLabel,
  SUMMARY_FADE_MS,
  SUMMARY_HOLD_MS,
} from "@modules/inbox/lib/feed-refresh-formatting";

export function FeedRefreshSummary({ feedId }: { feedId: string }) {
  const { refreshStatus, lastRefreshStartedAt, lastRefreshCompletedAt, lastRefreshFailedAt } =
    useFeedRefresh(feedId);

  const shouldPersist = refreshStatus === "running" || refreshStatus === "queued";
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">(
    shouldPersist ? "visible" : "hidden",
  );
  const previousStatusRef = useRef(refreshStatus);

  const summaryLabel = getRefreshSummaryLabel({
    refreshStatus,
    lastRefreshStartedAt,
    lastRefreshCompletedAt,
    lastRefreshFailedAt,
  });

  useEffect(() => {
    const prev = previousStatusRef.current;
    previousStatusRef.current = refreshStatus;

    if (shouldPersist) {
      setPhase("visible");
      return;
    }

    if (prev === "running" || prev === "queued") {
      setPhase("visible");
      const fadeTimer = window.setTimeout(() => {
        setPhase("fading");
      }, SUMMARY_HOLD_MS);

      const hideTimer = window.setTimeout(() => {
        setPhase("hidden");
      }, SUMMARY_HOLD_MS + SUMMARY_FADE_MS);

      return () => {
        window.clearTimeout(fadeTimer);
        window.clearTimeout(hideTimer);
      };
    }
  }, [refreshStatus, shouldPersist]);

  if (phase === "hidden") {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center text-muted-foreground transition-[opacity,filter,transform] ease-out motion-reduce:transition-none",
        phase === "visible"
          ? "translate-y-0 opacity-100 blur-0"
          : "-translate-y-px opacity-0 blur-[2px]",
      )}
      style={{ transitionDuration: `${SUMMARY_FADE_MS}ms` }}
    >
      <span className="px-1.5" aria-hidden>
        ·
      </span>
      <span>{summaryLabel}</span>
    </span>
  );
}
