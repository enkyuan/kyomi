import { router } from "expo-router";
import { useCallback, useMemo, type ReactElement } from "react";
import { type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { type SharedValue } from "react-native-reanimated";
import { ArticleListView, type ArticleListRowAction } from "../../../../../modules/article-list";
import { COMPACT_NAV_HEIGHT } from "@ui/header";
import { useArticleListStyle } from "@ui/native-list/style";
import { toArticleRow } from "@ui/native-list/rows";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { useTabBarMinimizeOffset, useTabBarMinimizeScroll } from "@ui/tab-bar/hooks/use-minimize";
import { type ArticleScope, useArticles } from "@modules/inbox/hooks/use-articles";
import { prefetchReaderArticle } from "@modules/articles/lib/requests";
import { useArticleRowActions } from "../../hooks/use-actions";
import type { InboxFilter } from "../../model";
import { ListSkeleton } from "./skeleton";

const NEAR_END_THRESHOLD = 0.5;

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

  const { items, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useArticles(scope);
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

  const performAction = useArticleRowActions(visibleItems);
  const minimizeOffset = useTabBarMinimizeOffset(scrollY);
  const minimizeScrollHandler = useTabBarMinimizeScroll(scrollY);

  // The list rests at `-topContentInset`; the header and tab bar track the distance scrolled.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<{ y: number }>) => {
      minimizeOffset(event.nativeEvent.y + topContentInset);
    },
    [minimizeOffset, topContentInset],
  );
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
      endReachedThreshold={NEAR_END_THRESHOLD}
      hasMore={hasNextPage}
      isFetchingMore={isFetchingNextPage}
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
      onScroll={handleScroll}
      rows={rows}
      scrollIndicatorInset={{ bottom: tabBarOcclusionHeight, top: scrollbarTopInset }}
      style={{ flex: 1 }}
    />
  );
}
