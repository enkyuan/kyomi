"use client";

import { ItemDetail } from "@components/pages/inbox/item-detail";
import { EmptyStateIcon } from "@components/icons/empty-state-svg";
import { ScrollAreaPrimitive, ScrollBar } from "@components/ui/scroll-area";
import { Skeleton } from "@components/ui/skeleton";
import type { ArticleDetailDto } from "@lib/api-schemas";

const EMPTY_STATE_BODY_COPY =
  "Stories from your feeds appear here so you can preview them before opening the original source.";
const EMPTY_STATE_BODY_WIDTH = 440;

interface InboxDetailViewProps {
  selectedItem: ArticleDetailDto | null;
  isDetailLoading: boolean;
  isDetailError: boolean;
  detailError: unknown;
}

export function InboxDetailView({
  selectedItem,
  isDetailLoading,
  isDetailError,
  detailError,
}: InboxDetailViewProps) {
  return (
    <section className="flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden rounded-2xl supports-[-webkit-touch-callout:none]:rounded-[1.75rem] border border-border bg-card text-card-foreground md:min-h-0">
      {selectedItem ? (
        <ScrollAreaPrimitive.Root className="min-h-0 flex-1 overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="h-full overflow-x-hidden outline-none data-has-overflow-y:overscroll-y-contain">
            <div className="min-h-full px-4 md:px-8">
              <ItemDetail item={selectedItem} />
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollBar orientation="vertical" />
        </ScrollAreaPrimitive.Root>
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
