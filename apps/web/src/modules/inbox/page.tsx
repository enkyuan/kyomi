"use client";

import { MobileLayout } from "./layouts/mobile";
import { Transition, type TransitionOffset } from "@kyomi/ui/transition";
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
  ACTIVE_FEED_REFRESH_POLL_INTERVAL_MS,
  followedFeedsQueryKey,
  hasActiveFeedRefresh,
} from "@modules/inbox/queries/options";
import { buildInboxItemSlug } from "@modules/inbox/lib/articles/slug";
import type { ArticleStepDirection } from "@modules/reader/lib/detail";
import { ArticleShell } from "./components/page/article/shell";
import { DetailSection } from "./components/page/detail";
import { ListSection } from "./components/page/list";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

const MIDDLE_COLUMN_TRANSITION_OFFSET: TransitionOffset = {
  forward: { enter: 18, exit: -12 },
  backward: { enter: -12, exit: 18 },
};

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
  const wasRefreshingFollowedFeedRef = useRef(false);
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
  });
  const { data: foldersData } = useQuery({
    queryKey: ["folders"],
    queryFn: () => listFolders(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  });
  const hasRefreshingFollowedFeed = hasActiveFeedRefresh(followedFeedsData);
  useEffect(() => {
    const refreshInboxConsumers = () => {
      void queryClient.invalidateQueries({ queryKey: followedFeedsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
      void queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
    };

    if (!hasRefreshingFollowedFeed) {
      if (wasRefreshingFollowedFeedRef.current) {
        wasRefreshingFollowedFeedRef.current = false;
        refreshInboxConsumers();
      }
      return;
    }

    wasRefreshingFollowedFeedRef.current = true;
    refreshInboxConsumers();
    const pollTimer = window.setInterval(
      refreshInboxConsumers,
      ACTIVE_FEED_REFRESH_POLL_INTERVAL_MS,
    );

    return () => window.clearInterval(pollTimer);
  }, [hasRefreshingFollowedFeed, queryClient]);
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
  const showMiddleColumnDetail = Boolean(itemId);
  const middleColumnTransition = useTransition({
    className: "absolute inset-0",
    contentKey: showMiddleColumnDetail ? "middle-article" : "middle-inbox",
    direction: showMiddleColumnDetail ? "forward" : "backward",
    features: "max",
    layoutGroupId: "inbox-middle-column",
    mode: "sync",
    offset: MIDDLE_COLUMN_TRANSITION_OFFSET,
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

  const middleColumnDetailElement = useMemo(
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
          <MiddleColumn
            detail={middleColumnDetailElement}
            list={listElement}
            showDetail={showMiddleColumnDetail}
            transition={middleColumnTransition}
          />
          <aside className="hidden h-full w-96 shrink-0 flex-col py-8 xl:flex">
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

function MiddleColumn({
  detail,
  list,
  showDetail,
  transition,
}: {
  detail: ReactNode;
  list: ReactNode;
  showDetail: boolean;
  transition: ReturnType<typeof useTransition>;
}) {
  return (
    <div className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      <div
        aria-hidden={showDetail}
        className={`absolute inset-0 flex min-h-0 min-w-0 flex-col transition-opacity duration-150 ${
          showDetail ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        inert={showDetail ? true : undefined}
      >
        {list}
      </div>
      {showDetail ? <Transition {...transition}>{detail}</Transition> : null}
    </div>
  );
}
