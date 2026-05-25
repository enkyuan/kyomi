"use client";

import { Skeleton } from "@vols.rss/ui/skeleton";
import type { InboxDensityDto } from "@lib/schemas";
import {
  DEFAULT_SKELETON_ROWS,
  getFeedItemRowEstimate,
  MAX_SKELETON_ROWS,
  MIN_SKELETON_ROWS,
  SKELETON_OVERSCAN_ROWS,
} from "@modules/inbox/lib/layout";

export type RowsPaginationState = {
  isLoading: boolean;
  isRefreshing: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

export function SkeletonRows({
  density,
  showFavicons,
  readerFocusMode = false,
  viewportHeight,
}: {
  density: InboxDensityDto;
  showFavicons: boolean;
  readerFocusMode?: boolean;
  viewportHeight?: number;
}) {
  const isCompact = density === "compact";
  const summaryLineCount = readerFocusMode ? (isCompact ? 4 : 5) : isCompact ? 2 : 3;
  const estimatedRowHeight = getFeedItemRowEstimate({ density, readerFocusMode });
  const fallbackViewportHeight =
    viewportHeight && viewportHeight > 0
      ? viewportHeight
      : typeof window !== "undefined"
        ? window.innerHeight
        : 0;
  const skeletonRowCount =
    fallbackViewportHeight > 0
      ? Math.max(
          MIN_SKELETON_ROWS,
          Math.min(
            MAX_SKELETON_ROWS,
            Math.ceil(fallbackViewportHeight / estimatedRowHeight) + SKELETON_OVERSCAN_ROWS,
          ),
        )
      : DEFAULT_SKELETON_ROWS;
  return (
    <ul className="w-full">
      {Array.from({ length: skeletonRowCount }).map((_, index) => (
        <li
          key={`skeleton-${index}`}
          className={`w-full border-x-0 border-border/70 bg-transparent${index === 0 ? "" : " border-t"}`}
        >
          <div
            className={
              isCompact ? "flex flex-col gap-1.5 px-5 py-2.5" : "flex flex-col gap-2 px-5 py-3"
            }
          >
            <div className="flex items-center gap-2">
              {showFavicons ? <Skeleton className="size-4.5 shrink-0 rounded-[3px]" /> : null}
              <Skeleton className="h-3 w-24 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4.5 w-full rounded" />
              <Skeleton className="h-4.5 w-3/4 rounded" />
            </div>
          </div>
          <div className="space-y-1.5 px-5">
            <Skeleton className="h-3.5 w-full rounded" />
            <Skeleton className="h-3.5 w-full rounded" />
            {Array.from({ length: Math.max(0, summaryLineCount - 2) }).map((_, index) => (
              <Skeleton
                key={`summary-line-${index}`}
                className={`h-3.5 rounded ${index === summaryLineCount - 3 ? "w-4/5" : "w-full"}`}
              />
            ))}
          </div>
          <div
            className={
              readerFocusMode
                ? isCompact
                  ? "mt-2 px-5 pb-3"
                  : "mt-2.5 px-5 pb-3.5"
                : isCompact
                  ? "mt-1.5 px-5 pb-2.5"
                  : "mt-2 px-5 pb-3"
            }
          >
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}
