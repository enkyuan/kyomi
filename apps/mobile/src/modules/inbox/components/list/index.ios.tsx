import { router } from "expo-router";
import { useCallback, useMemo, type ReactElement } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { type SharedValue } from "react-native-reanimated";
import { ArticleListView, type ArticleListRowAction } from "../../../../../modules/article-list";
import { COMPACT_NAV_HEIGHT } from "@ui/header";
import { useNativeListSync } from "@modules/articles/hooks/use-native-list-sync";
import { toArticleRow } from "@modules/articles/lib/list-rows";
import { useArticleListStyle } from "@modules/articles/lib/list-style";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import {
  useTabBarMinimizeNativeScroll,
  useTabBarMinimizeScroll,
} from "@ui/tab-bar/hooks/use-minimize";
import { type ArticleScope, useArticles } from "@modules/inbox/hooks/use-articles";
import { prefetchReaderArticle } from "@modules/articles/lib/requests";
import { useArticleRowActions } from "../../hooks/use-actions";
import type { InboxFilter } from "../../model";
import { ListSkeleton } from "./skeleton";

/** Rows from the last one at which the next page is fetched: about one screen of reading ahead. */
const NEAR_END_ROWS = 5;

type ListProps = {
  ListEmptyComponent: ReactElement;
  ListHeaderComponent?: ReactElement | null;
  filter: InboxFilter;
  scope: ArticleScope;
  scrollY: SharedValue<number>;
  topContentInset?: number;
};

/**
 * The feed as a native `UICollectionView` of SwiftUI rows. Only the visible rows exist, so the list
 * scales to any number of pages, and scrolling, paging and touches stay off the JS thread.
 */
export function List({
  ListEmptyComponent,
  ListHeaderComponent,
  filter,
  scope,
  scrollY,
  topContentInset = 0,
}: ListProps) {
  const insets = useSafeAreaInsets();
  const tabBarOcclusionHeight = getTabBarOcclusionHeight(insets);
  const scrollbarTopInset = insets.top + COMPACT_NAV_HEIGHT;
  const listStyle = useArticleListStyle();

  const { items, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, pageCount } =
    useArticles(scope);
  const visibleItems = useMemo(
    () =>
      filter === "unread"
        ? items.filter((item) => !item.isRead)
        : filter === "saved"
          ? items.filter((item) => item.isSaved)
          : items,
    [filter, items],
  );
  const rows = useMemo(() => visibleItems.map(toArticleRow), [visibleItems]);
  const listRef = useNativeListSync(rows, {
    hasMore: hasNextPage,
    isLoadingMore: isFetchingNextPage,
    pageCount,
  });

  const performAction = useArticleRowActions(visibleItems);
  const minimizeScrollHandler = useTabBarMinimizeScroll(scrollY);
  // The list rests at `-topContentInset`; the header and tab bar track the distance scrolled.
  const nativeScrollHandler = useTabBarMinimizeNativeScroll(scrollY, { offset: topContentInset });
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return (
      <ListSkeleton
        ListHeaderComponent={ListHeaderComponent}
        tabBarOcclusionHeight={tabBarOcclusionHeight}
        topContentInset={topContentInset}
      />
    );
  }

  if (visibleItems.length === 0) {
    return (
      <Animated.ScrollView
        automaticallyAdjustsScrollIndicatorInsets={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: tabBarOcclusionHeight,
          paddingTop: topContentInset,
        }}
        onScroll={minimizeScrollHandler}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ bottom: tabBarOcclusionHeight, top: scrollbarTopInset }}
      >
        {ListHeaderComponent}
        {ListEmptyComponent}
      </Animated.ScrollView>
    );
  }

  return (
    <ArticleListView
      contentInset={{ bottom: tabBarOcclusionHeight, top: topContentInset }}
      endReachedDistance={NEAR_END_ROWS}
      listStyle={listStyle}
      onEndReached={handleEndReached}
      onRowAction={({ nativeEvent }) =>
        performAction(nativeEvent.id, nativeEvent.action satisfies ArticleListRowAction)
      }
      onRowPress={({ nativeEvent }) =>
        router.push({
          pathname: "/(protected)/(tabs)/(inbox)/[article]",
          params: { article: nativeEvent.id },
        })
      }
      onRowPressIn={({ nativeEvent }) => prefetchReaderArticle(nativeEvent.id)}
      onScroll={nativeScrollHandler}
      ref={listRef}
      scrollIndicatorInset={{ bottom: tabBarOcclusionHeight, top: scrollbarTopInset }}
      style={{ flex: 1 }}
    />
  );
}
