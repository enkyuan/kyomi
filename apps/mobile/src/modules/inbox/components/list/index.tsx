import { AnimatedLegendList } from "@legendapp/list/reanimated";
import { router } from "expo-router";
import { type ReactElement } from "react";
import { Platform, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { type SharedValue } from "react-native-reanimated";
import { COMPACT_NAV_HEIGHT } from "@ui/header";
import type { InboxFilter } from "../../model";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { useTabBarMinimizeScroll } from "@ui/tab-bar/hooks/use-minimize";
import { type ArticleScope, useArticles } from "@modules/inbox/hooks/use-articles";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";
import { useEmptyPage } from "@modules/inbox/hooks/use-empty-page";
import { usePullToRefresh } from "@modules/inbox/hooks/use-pull-to-refresh";
import { prefetchReaderArticle } from "@modules/articles/lib/requests";
import { Item } from "../item";
import { ESTIMATED_ROW_SIZE, ListSkeleton } from "./skeleton";

const NEAR_END_THRESHOLD = 0.5;

type ListProps = {
  ListEmptyComponent: ReactElement;
  ListHeaderComponent?: ReactElement | null;
  filter: InboxFilter;
  scope: ArticleScope;
  scrollY: SharedValue<number>;
  topContentInset?: number;
};

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
  const isIOS = Platform.OS === "ios";

  const {
    items,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
    isError,
    pageCount,
  } = useArticles(scope);
  const pullToRefresh = usePullToRefresh(refetch);
  const visibleItems =
    filter === "unread"
      ? items.filter((item) => !item.isRead)
      : filter === "saved"
        ? items.filter((item) => item.isSaved)
        : items;
  const sharedValues = { scrollOffset: scrollY };
  const minimizeScrollHandler = useTabBarMinimizeScroll(scrollY);

  useEmptyPage(visibleItems.length, {
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    isError,
    pageCount,
    fetchNextPage,
  });

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
        refreshControl={
          // The scroll view starts at the screen's top edge and the header is padding over it, so
          // the spinner is offset to sit below the header, as LegendList's own is.
          <RefreshControl
            onRefresh={pullToRefresh.onRefresh}
            progressViewOffset={topContentInset}
            refreshing={pullToRefresh.refreshing}
          />
        }
        onScroll={minimizeScrollHandler}
        scrollEventThrottle={16}
        scrollIndicatorInsets={
          isIOS ? { bottom: tabBarOcclusionHeight, top: scrollbarTopInset } : undefined
        }
      >
        {ListHeaderComponent}
        {ListEmptyComponent}
      </Animated.ScrollView>
    );
  }

  return (
    <AnimatedLegendList
      ListHeaderComponent={ListHeaderComponent}
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      contentContainerStyle={{ paddingBottom: tabBarOcclusionHeight, paddingTop: topContentInset }}
      contentInsetAdjustmentBehavior="never"
      data={visibleItems}
      onRefresh={pullToRefresh.onRefresh}
      refreshing={pullToRefresh.refreshing}
      estimatedItemSize={ESTIMATED_ROW_SIZE}
      keyExtractor={(item: ArticleListItemDto) => item.id}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage && !isRefetching)
          void fetchNextPage({ cancelRefetch: false });
      }}
      onScroll={minimizeScrollHandler}
      scrollEventThrottle={16}
      onEndReachedThreshold={NEAR_END_THRESHOLD}
      renderItem={({ item, index }: { item: ArticleListItemDto; index: number }) => (
        <Item
          isFirst={index === 0}
          item={item}
          onPress={(pressedItem) =>
            router.push({
              pathname: "/(protected)/(tabs)/(inbox)/[article]",
              params: { article: pressedItem.id },
            })
          }
          onPressIn={(pressedItem) => prefetchReaderArticle(pressedItem.id)}
        />
      )}
      recycleItems
      scrollIndicatorInsets={
        isIOS ? { bottom: tabBarOcclusionHeight, top: scrollbarTopInset } : undefined
      }
      sharedValues={sharedValues}
    />
  );
}
