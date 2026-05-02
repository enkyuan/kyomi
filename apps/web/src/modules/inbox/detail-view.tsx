"use client";

import { ItemDetail } from "@modules/inbox/detail-panel";
import { EmptyStateIcon } from "@components/icons/empty-state-svg";
import { ScrollAreaPrimitive, ScrollBar } from "@components/ui/scroll-area";
import { Skeleton } from "@components/ui/skeleton";
import type { ArticleDetailDto, InboxTimestampDisplayDto } from "@lib/api-schemas";
import { Button } from "@components/ui/button";
import { ArrowLeftLine } from "@mingcute/react";

const EMPTY_STATE_BODY_COPY =
  "Stories from your feeds appear here so you can preview them before opening the original source.";
const EMPTY_STATE_BODY_WIDTH = 440;

interface InboxDetailViewProps {
  selectedItem: ArticleDetailDto | null;
  isDetailLoading: boolean;
  isDetailError: boolean;
  detailError: unknown;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  showBackToList?: boolean;
  onBackToList?: () => void;
}

export function InboxDetailView({
  selectedItem,
  isDetailLoading,
  isDetailError,
  detailError,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  showBackToList = false,
  onBackToList,
}: InboxDetailViewProps) {
  return (
    <section className="flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground md:min-h-0">
      <ScrollAreaPrimitive.Root className="min-h-0 flex-1 overflow-hidden">
        <ScrollAreaPrimitive.Viewport className="h-full overflow-x-hidden outline-none data-has-overflow-y:overscroll-y-contain mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem]">
          {selectedItem ? (
            <div
              className={
                showBackToList
                  ? "min-h-full pt-3 pl-3 pr-4 md:pl-3 md:pr-8"
                  : "min-h-full px-4 md:px-8"
              }
            >
              {showBackToList ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="sticky top-3 z-10 mb-3 gap-2"
                  onClick={onBackToList}
                >
                  <ArrowLeftLine className="size-4" />
                  Back to feed
                </Button>
              ) : null}
              <ItemDetail
                item={selectedItem}
                showFavicons={showFavicons}
                timestampDisplay={timestampDisplay}
                timestampHourCycle={timestampHourCycle}
              />
            </div>
          ) : isDetailLoading ? (
            <div className="flex min-h-0 flex-1 flex-col gap-5 p-12">
              <div className="space-y-3">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-6 w-3/4 rounded" />
                <Skeleton className="h-6 w-1/2 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-[94%] rounded" />
                <Skeleton className="h-4 w-[88%] rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-[91%] rounded" />
                <Skeleton className="h-4 w-[85%] rounded" />
              </div>
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-[96%] rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-[90%] rounded" />
              </div>
            </div>
          ) : isDetailError ? (
            <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
              <p className="text-base font-semibold text-foreground">Couldn't load article</p>
              <p className="text-sm text-muted-foreground">
                {detailError instanceof Error
                  ? detailError.message
                  : "There was a problem loading this item."}
              </p>
            </div>
          ) : (
            <div className="flex w-full h-full min-h-72 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
              <EmptyStateIcon className="size-40 shrink-0 sm:size-44" height={176} width={176} />
              <div className="w-full max-w-136 space-y-2">
                <p className="text-base font-semibold text-foreground">
                  Select an item to start reading
                </p>
                <BalancedEmptyStateBody text={EMPTY_STATE_BODY_COPY} />
              </div>
            </div>
          )}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar orientation="vertical" />
      </ScrollAreaPrimitive.Root>
    </section>
  );
}

function BalancedEmptyStateBody({ text }: { text: string }) {
  return (
    <p
      className="mx-auto text-sm leading-6 text-muted-foreground"
      style={{ maxWidth: `${EMPTY_STATE_BODY_WIDTH}px`, textWrap: "balance" }}
    >
      {text}
    </p>
  );
}
