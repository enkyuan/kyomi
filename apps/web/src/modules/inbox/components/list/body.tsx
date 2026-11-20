"use client";

import type { RefObject } from "react";
import { Badge } from "@kyomi/ui/components/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@kyomi/ui/components/empty";
import { EmptyStateIcon } from "@kyomi/ui/icons/empty-state";
import type { useViewport } from "@modules/inbox/hooks/use-viewport";
import type { InboxFilter, InboxItem } from "@modules/articles/lib/api";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@kyomi/reader/schemas";
import { VirtualizedRows, SkeletonRows, type RowsPaginationState } from "./rows";

const EMPTY_STATE_BODY_COPY =
  "Follow feeds to start building your reading list. New stories will show up here as they're published.";

function getEmptyStateCopy(filter: InboxFilter) {
  switch (filter) {
    case "my-feed":
      return {
        title: (
          <>
            Add a new feed or check out{" "}
            <Badge variant="secondary" size="lg">
              All
            </Badge>{" "}
            to get started
          </>
        ),
        description: EMPTY_STATE_BODY_COPY,
      };
    case "saved":
      return {
        title: "Nothing saved yet",
        description: "Saved articles will appear here when you mark them for later.",
      };
    case "recent":
      return {
        title: "No recent reads",
        description: "Articles you open will show up here after you read them.",
      };
    case "all":
    default:
      return {
        title: "No articles yet",
        description: "New stories will show up here after feeds publish or refresh.",
      };
  }
}

export function ListBody({
  density,
  filter,
  fontSizePx,
  inboxItems,
  initialScrollOffset,
  isLoading,
  isVirtualizerHostMounted,
  listContainerWidth,
  listScrollRef,
  pagination,
  readerFocusMode,
  selectedItemId,
  showEmptyState,
  showFavicons,
  timestampDisplay,
  timestampHourCycle,
  viewportHeight,
  onIntentItem,
  onSelectItem,
}: {
  density: InboxDensityDto;
  filter: InboxFilter;
  fontSizePx: number;
  inboxItems: InboxItem[];
  initialScrollOffset: number | undefined;
  isLoading: boolean;
  isVirtualizerHostMounted: boolean;
  listContainerWidth: ReturnType<typeof useViewport>["containerWidth"];
  listScrollRef: RefObject<HTMLDivElement | null>;
  pagination: RowsPaginationState;
  readerFocusMode: boolean;
  selectedItemId?: string | null;
  showEmptyState: boolean;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  viewportHeight: ReturnType<typeof useViewport>["viewportHeight"];
  onIntentItem?: (item: InboxItem) => void;
  onSelectItem: (item: InboxItem) => void;
}) {
  const emptyState = showEmptyState && getEmptyStateCopy(filter);

  return (
    <div className={showEmptyState ? "flex flex-1 flex-col" : ""}>
      {emptyState ? (
        <Empty className="w-full px-5.5" size="md">
          <EmptyHeader>
            <EmptyMedia variant="illustration">
              <EmptyStateIcon size={176} />
            </EmptyMedia>
            <EmptyTitle>{emptyState.title}</EmptyTitle>
            <EmptyDescription>{emptyState.description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : !isVirtualizerHostMounted ? (
        inboxItems.length === 0 && !isLoading ? null : (
          <SkeletonRows
            density={density}
            fontSizePx={fontSizePx}
            showFavicons={showFavicons}
            readerFocusMode={readerFocusMode}
            viewportHeight={viewportHeight}
          />
        )
      ) : (
        <VirtualizedRows
          listScrollRef={listScrollRef}
          filter={filter}
          readerFocusMode={readerFocusMode}
          density={density}
          fontSizePx={fontSizePx}
          showFavicons={showFavicons}
          listContainerWidth={listContainerWidth}
          timestampDisplay={timestampDisplay}
          timestampHourCycle={timestampHourCycle}
          inboxItems={inboxItems}
          selectedItemId={selectedItemId}
          pagination={pagination}
          onSelectItem={onSelectItem}
          onIntentItem={onIntentItem}
          viewportHeight={viewportHeight}
          initialScrollOffset={initialScrollOffset}
        />
      )}
    </div>
  );
}
