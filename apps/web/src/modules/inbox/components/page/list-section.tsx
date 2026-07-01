"use client";

import { useCallback, useMemo } from "react";
import type { useRouter } from "@tanstack/react-router";
import { List } from "@modules/inbox/components/list";
import type { InboxPreferences } from "@modules/inbox/hooks/use-inbox-data";
import type { useInboxRouteState } from "@modules/inbox/hooks/use-layout";
import { getPreviousInboxFeedId } from "@modules/inbox/lib/feed-history";
import type { InboxFilter, InboxItem } from "@modules/inbox/services/api";
import type { ArticleDetailDto } from "@lib/schemas";

function isGlobalInboxFilter(filter: InboxFilter) {
  return filter === "my-feed" || filter === "all" || filter === "saved" || filter === "recent";
}

// oxlint-disable-next-line react-doctor/no-many-boolean-props
export function ListSection({
  effectiveFilter,
  feedId,
  feedLabel,
  itemId,
  preferences,
  inboxItems,
  hasKnownEmptyFeedBackedView,
  hasNextInboxPage,
  inboxDataUpdatedAt,
  isInboxFetching,
  isInboxFetchingNextPage,
  isInboxPending,
  isResizing,
  fetchNextInboxPage,
  selectItem,
  navigate,
  router,
  sort,
  selectedItem,
  clearSelectedItem,
}: {
  effectiveFilter: ReturnType<typeof useInboxRouteState>["effectiveFilter"];
  feedId: string | undefined;
  feedLabel: string | undefined;
  itemId: string | undefined;
  preferences: InboxPreferences;
  inboxItems: InboxItem[];
  hasKnownEmptyFeedBackedView: boolean;
  hasNextInboxPage: boolean | undefined;
  inboxDataUpdatedAt: number;
  isInboxFetching: boolean;
  isInboxFetchingNextPage: boolean;
  isInboxPending: boolean;
  isResizing: boolean;
  fetchNextInboxPage: () => void;
  selectItem: (item: InboxItem) => void;
  navigate: ReturnType<typeof useInboxRouteState>["navigate"];
  router: ReturnType<typeof useRouter>;
  sort: ReturnType<typeof useInboxRouteState>["sort"];
  selectedItem: ArticleDetailDto | null;
  clearSelectedItem: () => void;
}) {
  const handleFilterChange = useCallback(
    (filter: InboxFilter) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          filter,
          feedId: isGlobalInboxFilter(filter) ? undefined : prev.feedId,
          folderId: isGlobalInboxFilter(filter) ? undefined : prev.folderId,
          itemId: undefined,
        }),
      });
    },
    [navigate],
  );

  const handleBackToInbox = useCallback(() => {
    const previousFeedId = getPreviousInboxFeedId(router.history.location.state);

    // TODO: Make feed-stack back behavior configurable once inbox navigation settings exist.
    if (previousFeedId && router.history.canGoBack()) {
      router.history.back();
      return;
    }

    void navigate({
      search: (prev) => ({
        ...prev,
        filter: "my-feed",
        search: undefined,
        feedId: undefined,
        folderId: undefined,
        itemId: undefined,
        showHidden: undefined,
        showRead: undefined,
      }),
    });
  }, [navigate, router.history]);

  const handleSortChange = useCallback(
    (nextSort: NonNullable<ReturnType<typeof useInboxRouteState>["sort"]>) => {
      void navigate({
        search: (prev) => ({
          ...prev,
          sort: nextSort === "newest" ? undefined : nextSort,
        }),
      });
    },
    [navigate],
  );

  const listProps = useMemo(
    () => ({
      inboxItems,
      filter: effectiveFilter,
      display: {
        showFavicons: preferences.inboxShowFavicons,
        disableVirtualization: isResizing,
      },
      density: preferences.inboxDensity,
      fontSizePx: preferences.inboxFontSizePx,
      timestampDisplay: preferences.inboxTimestampDisplay,
      timestampHourCycle: preferences.inboxTimestampHourCycle,
      selectedItemId: itemId,
      pagination: {
        isLoading: !hasKnownEmptyFeedBackedView && isInboxPending && inboxItems.length === 0,
        isRefreshing: isInboxFetching && !isInboxFetchingNextPage && inboxItems.length > 0,
        hasNextPage: !!hasNextInboxPage,
        isFetchingNextPage: isInboxFetchingNextPage,
        fetchNextPage: fetchNextInboxPage,
        dataUpdatedAt: inboxDataUpdatedAt,
      },
      onSelectItem: selectItem,
      onFilterChange: handleFilterChange,
      onBackToInbox: handleBackToInbox,
      onBackToList: clearSelectedItem,
      onSortChange: handleSortChange,
      sort,
      isFeedScoped: Boolean(feedId),
      feedLabel,
      isArticleScoped: Boolean(itemId),
      selectedArticle: selectedItem,
    }),
    [
      effectiveFilter,
      feedId,
      feedLabel,
      fetchNextInboxPage,
      handleBackToInbox,
      handleFilterChange,
      handleSortChange,
      hasKnownEmptyFeedBackedView,
      inboxItems,
      inboxDataUpdatedAt,
      isInboxFetchingNextPage,
      isInboxFetching,
      hasNextInboxPage,
      isInboxPending,
      isResizing,
      preferences.inboxDensity,
      preferences.inboxFontSizePx,
      preferences.inboxShowFavicons,
      preferences.inboxTimestampDisplay,
      preferences.inboxTimestampHourCycle,
      itemId,
      selectItem,
      selectedItem,
      sort,
      clearSelectedItem,
    ],
  );

  return <List {...listProps} display={{ ...listProps.display, readerFocusMode: false }} />;
}
