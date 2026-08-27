import { AnimatedLegendList } from "@legendapp/list/reanimated";
import { router } from "expo-router";
import { useMemo, type ReactElement } from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { type SharedValue } from "react-native-reanimated";
import { Skeleton } from "@ui/skeleton";
import { COMPACT_NAV_HEIGHT } from "@ui/header";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { useTabBarMinimizeScroll } from "@ui/tab-bar/hooks/use-minimize";
import { useArticles } from "@modules/inbox/hooks/use-articles";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";
import { feedItemTypography } from "@modules/inbox/lib/layout";
import { prefetchReaderArticle } from "@modules/reader/lib/article-request";
import { Item } from "../item";

const ESTIMATED_ROW_SIZE = 252;
const NEAR_END_THRESHOLD = 0.5;
const MIN_SKELETON_ROWS = 3;
const MAX_SKELETON_ROWS = 12;

type ListProps = {
  ListEmptyComponent: ReactElement;
  ListHeaderComponent?: ReactElement | null;
  scrollY: SharedValue<number>;
  topContentInset?: number;
};

export function List({
  ListEmptyComponent,
  ListHeaderComponent,
  scrollY,
  topContentInset = 0,
}: ListProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarOcclusionHeight = getTabBarOcclusionHeight(insets);
  const scrollbarTopInset = insets.top + COMPACT_NAV_HEIGHT;
  const isIOS = Platform.OS === "ios";

  const { items, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useArticles();
  const sharedValues = useMemo(() => ({ scrollOffset: scrollY }), [scrollY]);
  const minimizeScrollHandler = useTabBarMinimizeScroll(scrollY);

  if (isLoading) {
    const { titleLineHeightPx, summaryLineHeightPx, metaFontSizePx } = feedItemTypography;
    const rowCount = height
      ? Math.max(
          MIN_SKELETON_ROWS,
          Math.min(MAX_SKELETON_ROWS, Math.ceil(height / ESTIMATED_ROW_SIZE) + 1),
        )
      : 6;

    return (
      <View style={{ paddingTop: topContentInset }}>
        {ListHeaderComponent}
        {Array.from({ length: rowCount }).map((_, index) => (
          <View className="relative" key={index}>
            {index > 0 ? (
              <View className="absolute top-0 right-0 left-0 h-px bg-border/70" />
            ) : null}

            <View className="gap-4 px-5 pt-5 pb-2.5">
              <View className="flex-row items-center justify-between gap-4">
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  <Skeleton className="size-5.5 shrink-0" radius={4} />
                  <Skeleton
                    className="w-28"
                    radius={4}
                    style={{ height: Math.max(13, metaFontSizePx) }}
                  />
                </View>
                <Skeleton
                  className="w-16 shrink-0"
                  radius={4}
                  style={{ height: Math.max(13, metaFontSizePx) }}
                />
              </View>
              <View className="gap-1.5">
                <Skeleton className="w-full" radius={4} style={{ height: titleLineHeightPx }} />
                <Skeleton className="w-[70%]" radius={4} style={{ height: titleLineHeightPx }} />
              </View>
            </View>

            <View className="gap-1.5 px-5">
              <Skeleton className="w-full" radius={4} style={{ height: summaryLineHeightPx }} />
              <Skeleton className="w-full" radius={4} style={{ height: summaryLineHeightPx }} />
            </View>

            <View className="mt-3 flex-row items-center gap-1.5 px-5 pb-4">
              <Skeleton className="h-5 w-16" radius="round" />
              <Skeleton className="h-5 w-24" radius="round" />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <Animated.ScrollView
        automaticallyAdjustsScrollIndicatorInsets={false}
        contentContainerStyle={{ flexGrow: 1, paddingTop: topContentInset }}
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
      contentContainerStyle={{ paddingTop: topContentInset }}
      contentInsetAdjustmentBehavior="never"
      data={items}
      estimatedItemSize={ESTIMATED_ROW_SIZE}
      keyExtractor={(item: ArticleListItemDto) => item.id}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
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
