"use client";

import { MobileLayout } from "./layouts/mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { InboxRecapCard } from "./components/recap";
import {
  InboxPreferencesBootstrapProvider,
  type InboxPreferences,
  dedupePagedInboxItemsById,
  useInboxItemStateMutation,
  useInboxPreferences,
  useInboxQueries,
  useRecordInboxItemView,
} from "@modules/inbox/hooks/use-inbox-data";
import {
  type InboxRouteSearch,
  useInboxRouteState,
  useMarkReadBehavior,
  useResponsiveReaderMode,
} from "@modules/inbox/hooks/use-layout";
import type { InboxItem } from "@modules/inbox/lib/articles/index";
import { useTimezone } from "@hooks/use-timezone";
import { useTransition } from "@hooks/use-transition";
import { useViewport } from "@hooks/use-viewport";
import { QUERY_TIMES } from "@lib/query/policies";
import { writeShellStateSnapshot } from "@lib/shell/state";
import { listFollowedFeeds } from "@modules/feeds/lib/api";
import { listFolders } from "@modules/folders/lib/api";
import {
  followedFeedsQueryKey,
  getFeedRefreshPollInterval,
  prefetchInboxSegmentedControlTarget,
} from "@modules/inbox/queries/options";
import { buildInboxItemSlug } from "@modules/inbox/lib/articles/slug";
import type { ArticleStepDirection } from "@modules/reader/lib/detail";
import { usePolling } from "./hooks/use-polling";
import { ArticleShell } from "./components/page/article/shell";
import { DetailSection } from "./components/page/detail";
import { Feed, FEED_TRANSITION_OFFSET } from "./components/page/feed";
import { ListSection } from "./components/page/list";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type InboxPageProps = {
  initialInboxPreferences?: InboxPreferences;
  initialTimezoneOffsetMinutes?: number;
};

export function Page({ initialInboxPreferences, initialTimezoneOffsetMinutes }: InboxPageProps) {
  return (
    <InboxPreferencesBootstrapProvider initialPreferences={initialInboxPreferences}>
      <InboxPageContent
        initialInboxPreferences={initialInboxPreferences}
        initialTimezoneOffsetMinutes={initialTimezoneOffsetMinutes}
      />
    </InboxPreferencesBootstrapProvider>
  );
}

function InboxPageContent({
  initialInboxPreferences,
  initialTimezoneOffsetMinutes,
}: InboxPageProps) {
  const { preferences } = useInboxPreferences(initialInboxPreferences);
  const router = useRouter();
  const queryClient = useQueryClient();
  const layoutContainerRef = useRef<HTMLDivElement | null>(null);
  const { containerWidth: layoutContainerWidth } = useViewport(layoutContainerRef);
  const layoutVariant = useResponsiveReaderMode(layoutContainerWidth);
  const [mobileTransitionDirection, setMobileTransitionDirection] = useState<1 | -1>(1);
  const [articleStepDirection, setArticleStepDirection] = useState<ArticleStepDirection>(1);
  const clientTimezoneOffsetMinutes = useTimezone();
  const timezoneOffsetMinutes = clientTimezoneOffsetMinutes ?? initialTimezoneOffsetMinutes;

  const route = useInboxRouteState(preferences);
  const {
    navigate,
    search,
    feedId,
    folderId,
    itemId,
    rail,
    railFolderBack,
    railFolderId,
    effectiveFilter,
    isReadScopedFilterActive,
    includeRead,
    sort,
  } = route;

  const {
    detailData,
    detailError,
    fetchNextInboxPage: requestNextInboxPage,
    hasNextInboxPage,
    inboxData,
    inboxDataUpdatedAt,
    isDetailError,
    isDetailFetching,
    isInboxFetching,
    isInboxFetchingNextPage,
    isInboxPending,
  } = useInboxQueries({
    filter: effectiveFilter,
    search,
    feedId,
    folderId,
    itemId,
    includeRead,
    sort,
    timezoneOffsetMinutes,
  });
  const { isSuccess: isFollowedFeedsSuccess, data: followedFeedsData } = useQuery({
    queryKey: followedFeedsQueryKey(),
    queryFn: () => listFollowedFeeds(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
    refetchInterval: (query) =>
      getFeedRefreshPollInterval(
        query.state.data as Awaited<ReturnType<typeof listFollowedFeeds>> | undefined,
      ),
    refetchIntervalInBackground: false,
  });
  const { data: foldersData } = useQuery({
    queryKey: ["folders"],
    queryFn: () => listFolders(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  });
  usePolling(followedFeedsData);
  const hasNoFollowedFeeds = isFollowedFeedsSuccess && (followedFeedsData?.length ?? 0) === 0;
  const pinnedFolders = useMemo(
    () =>
      (foldersData ?? [])
        .filter((folder) => folder.isPinned)
        .sort((left, right) => {
          const leftTime = left.pinnedAt ? new Date(left.pinnedAt).getTime() : 0;
          const rightTime = right.pinnedAt ? new Date(right.pinnedAt).getTime() : 0;
          if (leftTime !== rightTime) {
            return rightTime - leftTime;
          }
          return left.name.localeCompare(right.name);
        }),
    [foldersData],
  );
  useEffect(() => {
    if (timezoneOffsetMinutes === undefined) {
      return;
    }

    void prefetchInboxSegmentedControlTarget(queryClient, {
      filter: effectiveFilter,
      search,
      feedId,
      folderId,
      includeRead,
      sort,
      timezoneOffsetMinutes,
    }).catch(() => undefined);
  }, [
    effectiveFilter,
    feedId,
    folderId,
    includeRead,
    queryClient,
    search,
    sort,
    timezoneOffsetMinutes,
  ]);
  const activeFeedLabel = useMemo(() => {
    if (!feedId) {
      return undefined;
    }
    const activeFeed = followedFeedsData?.find((feed) => feed.feedId === feedId);
    return activeFeed?.title || activeFeed?.url;
  }, [feedId, followedFeedsData]);
  const isFeedBackedListView =
    !search &&
    !feedId &&
    !folderId &&
    effectiveFilter !== "my-feed" &&
    effectiveFilter !== "all" &&
    effectiveFilter !== "saved" &&
    effectiveFilter !== "recent";
  const hasKnownEmptyFeedBackedView = hasNoFollowedFeeds && isFeedBackedListView;

  const rawInboxItems = useMemo(
    () => dedupePagedInboxItemsById(inboxData?.pages),
    [inboxData?.pages],
  );

  const inboxItems = useMemo(() => {
    if (isReadScopedFilterActive) {
      return rawInboxItems.filter((item) => item.isRead);
    }
    return rawInboxItems;
  }, [isReadScopedFilterActive, rawInboxItems]);

  const selectedItem = detailData?.item ?? null;
  const showFeedDetail = Boolean(itemId);
  const feedTransition = useTransition({
    className: "absolute inset-0",
    contentKey: showFeedDetail ? "feed-article" : "feed-list",
    direction: showFeedDetail ? "forward" : "backward",
    features: "max",
    layoutGroupId: "inbox-feed",
    mode: "sync",
    offset: FEED_TRANSITION_OFFSET,
  });
  const { mutate: updateInboxItemState } = useInboxItemStateMutation();
  const markItemRead = useCallback(
    (nextItemId: string) => {
      updateInboxItemState({
        itemId: nextItemId,
        patch: { isRead: true },
      });
    },
    [updateInboxItemState],
  );
  useRecordInboxItemView(itemId);
  useMarkReadBehavior({
    itemId,
    selectedItem,
    effectiveFilter,
    markReadBehavior: preferences.inboxMarkReadBehavior,
    onMarkRead: markItemRead,
  });
  const selectedItemIndex = useMemo(() => {
    if (!selectedItem) {
      return -1;
    }
    return inboxItems.findIndex((item) => item.id === selectedItem.id);
  }, [inboxItems, selectedItem]);
  const canSelectPreviousItem = selectedItemIndex > 0;
  const canSelectNextItem = selectedItemIndex >= 0 && selectedItemIndex < inboxItems.length - 1;

  const clearSelectedItem = useCallback(() => {
    setMobileTransitionDirection(-1);
    void router.navigate({
      to: "/inbox",
      search: (prev: InboxRouteSearch) => ({
        ...prev,
        itemId: undefined,
      }),
    });
  }, [router]);

  const selectItem = useCallback(
    (item: InboxItem, direction: ArticleStepDirection = 1) => {
      setMobileTransitionDirection(1);
      setArticleStepDirection(direction);
      void router.navigate({
        to: "/inbox/$article",
        params: {
          article: buildInboxItemSlug(item),
        },
        search: (prev: InboxRouteSearch) => ({
          ...prev,
          itemId: undefined,
        }),
      });
    },
    [router],
  );

  const selectAdjacentItem = useCallback(
    (offset: -1 | 1) => {
      if (selectedItemIndex < 0) {
        return;
      }
      const nextItem = inboxItems[selectedItemIndex + offset];
      if (!nextItem) {
        return;
      }
      selectItem(nextItem, offset);
    },
    [inboxItems, selectItem, selectedItemIndex],
  );

  const fetchNextInboxPage = useCallback(() => {
    void requestNextInboxPage();
  }, [requestNextInboxPage]);

  useEffect(() => {
    writeShellStateSnapshot({
      inboxFilter: effectiveFilter,
      inboxLayout: layoutVariant,
      selectedItemId: itemId ?? null,
    });
  }, [effectiveFilter, itemId, layoutVariant]);

  const listElement = (
    <ListSection
      effectiveFilter={effectiveFilter}
      feedId={feedId}
      feedLabel={activeFeedLabel}
      folderId={folderId}
      itemId={itemId}
      pinnedFolders={pinnedFolders}
      preferences={preferences}
      inboxItems={inboxItems}
      hasKnownEmptyFeedBackedView={hasKnownEmptyFeedBackedView}
      hasNextInboxPage={hasNextInboxPage}
      inboxDataUpdatedAt={inboxDataUpdatedAt}
      isInboxFetching={isInboxFetching}
      isInboxFetchingNextPage={isInboxFetchingNextPage}
      isInboxPending={isInboxPending}
      showScrollbar={!showFeedDetail}
      fetchNextInboxPage={fetchNextInboxPage}
      selectItem={selectItem}
      navigate={navigate}
      router={router}
      sort={sort}
      selectedItem={selectedItem}
      clearSelectedItem={clearSelectedItem}
    />
  );

  const detailElementWithBack = useMemo(
    () => (
      <DetailSection
        preferences={preferences}
        detailError={detailError}
        isDetailError={isDetailError}
        isDetailFetching={isDetailFetching}
        selectedItem={selectedItem}
        showBackToList
        surface="card"
        clearSelectedItem={clearSelectedItem}
      />
    ),
    [clearSelectedItem, detailError, isDetailError, isDetailFetching, preferences, selectedItem],
  );

  const feedDetailElement = useMemo(
    () => (
      <ArticleShell
        preferences={preferences}
        detailError={detailError}
        isDetailError={isDetailError}
        isDetailFetching={isDetailFetching}
        selectedItem={selectedItem}
        onBackToList={clearSelectedItem}
        onSelectPreviousItem={() => selectAdjacentItem(-1)}
        onSelectNextItem={() => selectAdjacentItem(1)}
        canSelectPreviousItem={canSelectPreviousItem}
        canSelectNextItem={canSelectNextItem}
        articleStepDirection={articleStepDirection}
      />
    ),
    [
      articleStepDirection,
      canSelectNextItem,
      canSelectPreviousItem,
      clearSelectedItem,
      detailError,
      isDetailError,
      isDetailFetching,
      preferences,
      selectAdjacentItem,
      selectedItem,
    ],
  );

  return (
    <div ref={layoutContainerRef} className="h-full max-h-full min-h-0 min-w-0">
      {layoutVariant === "stacked" ? (
        <MobileLayout
          showDetail={Boolean(itemId)}
          direction={mobileTransitionDirection}
          list={listElement}
          detail={detailElementWithBack}
        />
      ) : (
        <div className="flex h-full max-h-full min-h-0 min-w-0 overflow-hidden pe-3">
          <Feed
            detail={feedDetailElement}
            list={listElement}
            showDetail={showFeedDetail}
            transition={feedTransition}
          />
          <aside className="hidden h-full w-96 shrink-0 flex-col py-4.5 xl:flex">
            {/* Article detail replaces the inbox pane; keep this rail reserved for future context. */}
            <InboxRecapCard
              navigate={navigate}
              rail={rail}
              railFolderBack={railFolderBack}
              railFolderId={railFolderId}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
