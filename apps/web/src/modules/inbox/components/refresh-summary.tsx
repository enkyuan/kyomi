"use client";

import { useEffect, useReducer, useRef } from "react";
import { useFeedRefresh } from "@modules/feeds/hooks/use-feed-refresh";
import { cn } from "@lib/utils";
import {
  getRefreshSummaryLabel,
  SUMMARY_FADE_MS,
  SUMMARY_HOLD_MS,
} from "../lib/feed-refresh-formatting";

type SummaryPhase = "visible" | "fading" | "hidden";

type SummaryPhaseAction =
  | { type: "persist" }
  | { type: "show_completion" }
  | { type: "fade" }
  | { type: "hide" };

function summaryPhaseReducer(phase: SummaryPhase, action: SummaryPhaseAction): SummaryPhase {
  switch (action.type) {
    case "persist":
    case "show_completion":
      return "visible";
    case "fade":
      return "fading";
    case "hide":
      return "hidden";
    default:
      return phase;
  }
}

export function FeedRefreshSummary({ feedId }: { feedId: string }) {
  const { refreshStatus, lastRefreshStartedAt, lastRefreshCompletedAt, lastRefreshFailedAt } =
    useFeedRefresh(feedId);

  const shouldPersist = refreshStatus === "running" || refreshStatus === "queued";
  const [phase, dispatchPhase] = useReducer(
    summaryPhaseReducer,
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
      dispatchPhase({ type: "persist" });
      return;
    }

    if (prev === "running" || prev === "queued") {
      dispatchPhase({ type: "show_completion" });
      const fadeTimer = window.setTimeout(() => {
        dispatchPhase({ type: "fade" });
      }, SUMMARY_HOLD_MS);

      const hideTimer = window.setTimeout(() => {
        dispatchPhase({ type: "hide" });
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
