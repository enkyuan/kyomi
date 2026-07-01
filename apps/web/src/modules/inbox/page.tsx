/* oxlint-disable max-lines */
"use client";

import { AppShell } from "@/app/app-shell";
import { Detail, type DetailHeaderState } from "@modules/reader/components/detail";
import { MobileLayout } from "./layouts/mobile";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { DownFill, UpFill } from "@mingcute/react";
import {
  AnimatePresence,
  LayoutGroup,
  LazyMotion,
  domAnimation,
  domMax,
  m,
  useReducedMotion,
} from "motion/react";
import { List } from "./components/list";
import { BackToInboxButton, SearchBar } from "./components/list/header";
import {
  ReaderFontSizeControls,
  Toolbar as ReaderToolbar,
} from "@modules/reader/components/toolbar";
import { useToolbar as useReaderToolbar } from "@modules/reader/hooks/use-toolbar";
import { Button } from "@kyomi/ui/button";
import {
  InboxPreferencesBootstrapProvider,
  type InboxPreferences,
  dedupePagedInboxItemsById,
  useInboxPreferences,
  useInboxQueries,
} from "@modules/inbox/hooks/use-inbox-data";
import { useInboxRouteState, useResponsiveReaderMode } from "@modules/inbox/hooks/use-layout";
import type { InboxFilter, InboxItem } from "@modules/inbox/services/api";
import { useTimezone } from "@hooks/use-timezone";
import { useViewport } from "@hooks/use-viewport";
import { QUERY_TIMES } from "@lib/query/policies";
import { writeShellStateSnapshot } from "@lib/shell/state";
import { listFollowedFeeds } from "@modules/feeds/api";
import { followedFeedsQueryKey } from "@modules/inbox/queries/options";
import { buildInboxItemSlug } from "@modules/inbox/lib/article-slug";
import { getPreviousInboxFeedId } from "@modules/inbox/lib/feed-history";
import type { ArticleDetailDto } from "@lib/schemas";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function isGlobalInboxFilter(filter: InboxFilter) {
  return filter === "my-feed" || filter === "all" || filter === "saved" || filter === "recent";
}

type ArticleStepDirection = 1 | -1;

export function Page({
  initialInboxPreferences,
  initialSplitPanePercent: _initialSplitPanePercent,
}: {
  initialInboxPreferences?: InboxPreferences;
  initialSplitPanePercent?: number;
}) {
  return (
    <InboxPreferencesBootstrapProvider initialPreferences={initialInboxPreferences}>
      <InboxPageContent initialInboxPreferences={initialInboxPreferences} />
    </InboxPreferencesBootstrapProvider>
  );
}

function InboxPageContent({
  initialInboxPreferences,
}: {
  initialInboxPreferences?: InboxPreferences;
}) {
  const { preferences } = useInboxPreferences(initialInboxPreferences);
  const router = useRouter();
  const layoutContainerRef = useRef<HTMLDivElement | null>(null);
  const { containerWidth: layoutContainerWidth } = useViewport(layoutContainerRef);
  const layoutVariant = useResponsiveReaderMode(layoutContainerWidth);
  const [mobileTransitionDirection, setMobileTransitionDirection] = useState<1 | -1>(1);
  const [articleStepDirection, setArticleStepDirection] = useState<ArticleStepDirection>(1);
  const timezoneOffsetMinutes = useTimezone();

  const route = useInboxRouteState(preferences);
  const {
    navigate,
    search,
    feedId,
    folderId,
    itemId,
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
  const hasNoFollowedFeeds = isFollowedFeedsSuccess && (followedFeedsData?.length ?? 0) === 0;
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
      search: (prev) => ({
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
        search: (prev) => ({
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
    <InboxListSection
      effectiveFilter={effectiveFilter}
      feedId={feedId}
      feedLabel={activeFeedLabel}
      itemId={itemId}
      preferences={preferences}
      inboxItems={inboxItems}
      hasKnownEmptyFeedBackedView={hasKnownEmptyFeedBackedView}
      hasNextInboxPage={hasNextInboxPage}
      inboxDataUpdatedAt={inboxDataUpdatedAt}
      isInboxFetching={isInboxFetching}
      isInboxFetchingNextPage={isInboxFetchingNextPage}
      isInboxPending={isInboxPending}
      isResizing={false}
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
      <InboxDetailSection
        preferences={preferences}
        detailError={detailError}
        isDetailError={isDetailError}
        isDetailFetching={isDetailFetching}
        selectedItem={selectedItem}
        showBackToList
        clearSelectedItem={clearSelectedItem}
      />
    ),
    [clearSelectedItem, detailError, isDetailError, isDetailFetching, preferences, selectedItem],
  );

  const middleColumnDetailElement = useMemo(
    () => (
      <MiddleColumnArticle
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
    <AppShell>
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
            <MiddleColumnTransition
              showDetail={Boolean(itemId)}
              list={listElement}
              detail={middleColumnDetailElement}
            />
            <aside className="hidden h-full w-96 shrink-0 flex-col py-8 xl:flex">
              {/* Article detail replaces the inbox pane; keep this rail reserved for future context. */}
              <InboxSidebarCard />
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function MiddleColumnTransition({
  showDetail,
  list,
  detail,
}: {
  showDetail: boolean;
  list: ReactNode;
  detail: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.28, bounce: 0 };

  return (
    <LazyMotion features={domMax}>
      <m.div initial={false} className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <LayoutGroup id="inbox-middle-column">
          <AnimatePresence initial={false} mode="sync">
            {showDetail ? (
              <m.div
                key="middle-article"
                className="absolute inset-0 flex min-h-0 min-w-0 flex-col"
                initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: -12 }}
                transition={transition}
              >
                {detail}
              </m.div>
            ) : (
              <m.div
                key="middle-inbox"
                className="absolute inset-0 flex min-h-0 min-w-0 flex-col"
                initial={prefersReducedMotion ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: 18 }}
                transition={transition}
              >
                {list}
              </m.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </m.div>
    </LazyMotion>
  );
}

function InboxSidebarCard() {
  return (
    <div className="h-full flex-1 rounded-2xl border border-border bg-card text-card-foreground shadow-sm/5" />
  );
}

// oxlint-disable-next-line react-doctor/no-many-boolean-props
function MiddleColumnArticle({
  preferences,
  detailError,
  isDetailError,
  isDetailFetching,
  selectedItem,
  onBackToList,
  onSelectPreviousItem,
  onSelectNextItem,
  canSelectPreviousItem,
  canSelectNextItem,
  articleStepDirection,
}: {
  preferences: InboxPreferences;
  detailError: unknown;
  isDetailError: boolean;
  isDetailFetching: boolean;
  selectedItem: ArticleDetailDto | null;
  onBackToList: () => void;
  onSelectPreviousItem: () => void;
  onSelectNextItem: () => void;
  canSelectPreviousItem: boolean;
  canSelectNextItem: boolean;
  articleStepDirection: ArticleStepDirection;
}) {
  const header = selectedItem
    ? ({ readerControlsCollapsed }: DetailHeaderState) => (
        <SelectedMiddleColumnArticleHeader
          item={selectedItem}
          readerControlsCollapsed={readerControlsCollapsed}
          onBackToList={onBackToList}
          onSelectPreviousItem={onSelectPreviousItem}
          onSelectNextItem={onSelectNextItem}
          canSelectPreviousItem={canSelectPreviousItem}
          canSelectNextItem={canSelectNextItem}
        />
      )
    : () => <MiddleColumnArticleHeaderShell onBackToList={onBackToList} />;

  return (
    <section className="relative flex h-full max-h-full min-h-80 min-w-0 flex-col overflow-hidden [--inbox-header-height:3rem] md:min-h-0">
      <div className="min-h-0 min-w-0 flex-1">
        <InboxDetailSection
          preferences={preferences}
          detailError={detailError}
          isDetailError={isDetailError}
          isDetailFetching={isDetailFetching}
          selectedItem={selectedItem}
          surface="inbox"
          header={header}
          articleContentKey={selectedItem?.id}
          articleStepDirection={articleStepDirection}
        />
      </div>
    </section>
  );
}

function MiddleColumnArticleHeaderShell({ onBackToList }: { onBackToList: () => void }) {
  return (
    <div
      className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 bg-transparent px-5.5 pt-8 pb-2 isolate"
      data-slot="inbox-article-header"
    >
      <div className="flex min-w-0 items-center gap-2">
        <BackToInboxButton onClick={onBackToList} />
      </div>
      <SearchBar />
    </div>
  );
}

function SelectedMiddleColumnArticleHeader({
  item,
  readerControlsCollapsed,
  onBackToList,
  onSelectPreviousItem,
  onSelectNextItem,
  canSelectPreviousItem,
  canSelectNextItem,
}: {
  item: ArticleDetailDto;
  readerControlsCollapsed: boolean;
  onBackToList: () => void;
  onSelectPreviousItem: () => void;
  onSelectNextItem: () => void;
  canSelectPreviousItem: boolean;
  canSelectNextItem: boolean;
}) {
  const toolbar = useReaderToolbar({ item, readerFocusMode: true, autoExtract: false });
  const prefersReducedMotion = useReducedMotion();
  const scopeControlTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.28, bounce: 0 };

  return (
    <div
      className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 bg-transparent px-5.5 pt-8 pb-2 isolate"
      data-slot="inbox-article-header"
    >
      <LazyMotion features={domAnimation}>
        <m.div
          layout
          className="flex min-w-0 items-center gap-2"
          transition={scopeControlTransition}
        >
          <SelectedArticleHeaderControls
            toolbar={toolbar}
            readerControlsCollapsed={readerControlsCollapsed}
            onBackToList={onBackToList}
          />
        </m.div>
        <m.div
          layout
          className="flex min-w-0 flex-1 items-center justify-end gap-2"
          transition={scopeControlTransition}
        >
          <m.div
            layout
            className="flex min-w-0 flex-1 justify-end"
            transition={scopeControlTransition}
          >
            <SearchBar />
          </m.div>
          <m.div layout transition={scopeControlTransition}>
            <ArticleStepControls
              canSelectPreviousItem={canSelectPreviousItem}
              canSelectNextItem={canSelectNextItem}
              onSelectPreviousItem={onSelectPreviousItem}
              onSelectNextItem={onSelectNextItem}
            />
          </m.div>
        </m.div>
      </LazyMotion>
    </div>
  );
}

function SelectedArticleHeaderControls({
  toolbar,
  readerControlsCollapsed,
  onBackToList,
}: {
  toolbar: ReturnType<typeof useReaderToolbar>;
  readerControlsCollapsed: boolean;
  onBackToList: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };

  return (
    <>
      <m.div layout transition={transition}>
        <BackToInboxButton onClick={onBackToList} />
      </m.div>
      <MiddleColumnReaderToolbar collapsed={readerControlsCollapsed} toolbar={toolbar} />
      <m.div layout transition={transition}>
        <ReaderFontSizeControls
          canDecreaseFont={toolbar.toolbarProps.canDecreaseFont}
          canIncreaseFont={toolbar.toolbarProps.canIncreaseFont}
          fontSizePx={toolbar.toolbarProps.fontSizePx}
          onDecreaseFontSize={toolbar.toolbarProps.onDecreaseFontSize}
          onIncreaseFontSize={toolbar.toolbarProps.onIncreaseFontSize}
        />
      </m.div>
    </>
  );
}

function ArticleStepControls({
  canSelectPreviousItem,
  canSelectNextItem,
  onSelectPreviousItem,
  onSelectNextItem,
}: {
  canSelectPreviousItem: boolean;
  canSelectNextItem: boolean;
  onSelectPreviousItem: () => void;
  onSelectNextItem: () => void;
}) {
  return (
    <nav
      aria-label="Article navigation"
      className="relative flex h-11 w-21 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full bg-background p-1 text-muted-foreground before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative"
    >
      <Button
        aria-label="Previous article"
        className="size-9 rounded-full text-muted-foreground transition-colors hover:text-foreground"
        disabled={!canSelectPreviousItem}
        size="icon-lg"
        variant="ghost"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelectPreviousItem();
        }}
      >
        <UpFill className="size-4" />
      </Button>
      <Button
        aria-label="Next article"
        className="size-9 rounded-full text-muted-foreground transition-colors hover:text-foreground"
        disabled={!canSelectNextItem}
        size="icon-lg"
        variant="ghost"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelectNextItem();
        }}
      >
        <DownFill className="size-4" />
      </Button>
    </nav>
  );
}

function MiddleColumnReaderToolbar({
  toolbar,
  collapsed,
}: {
  toolbar: ReturnType<typeof useReaderToolbar>;
  collapsed: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };

  return (
    <m.div
      layout
      className="relative inline-flex h-11 min-w-0 max-w-96 items-center overflow-hidden rounded-full bg-background px-1.5 font-medium text-base text-muted-foreground before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative"
      transition={transition}
    >
      <ReaderToolbar
        {...toolbar.toolbarProps}
        controlSize="large"
        hideFontControls
        readerFocusVariant={collapsed ? "compact" : "full"}
      />
    </m.div>
  );
}

// oxlint-disable-next-line react-doctor/no-many-boolean-props
function InboxListSection({
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

function InboxDetailSection({
  preferences,
  detailError,
  isDetailError,
  isDetailFetching,
  selectedItem,
  clearSelectedItem,
  showBackToList,
  surface,
  header,
  articleContentKey,
  articleStepDirection,
}: {
  preferences: InboxPreferences;
  detailError: unknown;
  isDetailError: boolean;
  isDetailFetching: boolean;
  selectedItem: ArticleDetailDto | null;
  clearSelectedItem?: () => void;
  showBackToList?: boolean;
  surface?: "card" | "inbox";
  header?: ReactNode | ((state: DetailHeaderState) => ReactNode);
  articleContentKey?: string;
  articleStepDirection?: ArticleStepDirection;
}) {
  const isDetailLoading = isDetailFetching && !selectedItem;

  const detailProps = useMemo(
    () => ({
      detailState: selectedItem
        ? ({ status: "selected", item: selectedItem } as const)
        : isDetailLoading
          ? ({ status: "loading" } as const)
          : isDetailError
            ? ({ status: "error", error: detailError } as const)
            : ({ status: "empty" } as const),
      density: preferences.inboxDensity,
      fontSizePx: preferences.inboxFontSizePx,
      showFavicons: preferences.inboxShowFavicons,
      timestampDisplay: preferences.inboxTimestampDisplay,
      timestampHourCycle: preferences.inboxTimestampHourCycle,
    }),
    [
      detailError,
      isDetailError,
      isDetailLoading,
      preferences.inboxDensity,
      preferences.inboxFontSizePx,
      preferences.inboxShowFavicons,
      preferences.inboxTimestampDisplay,
      preferences.inboxTimestampHourCycle,
      selectedItem,
    ],
  );

  return (
    <Detail
      {...detailProps}
      showBackToList={showBackToList}
      onBackToList={clearSelectedItem}
      surface={surface}
      header={header}
      articleContentKey={articleContentKey}
      articleStepDirection={articleStepDirection}
    />
  );
}
