import { AnimatedLegendList } from "@legendapp/list/reanimated";
import { router } from "expo-router";
import { Platform, useWindowDimensions, View } from "react-native";
import { useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Skeleton } from "@ui/skeleton";
import { getTabBarOcclusionHeight } from "@/components/ui/tab-bar/lib/styles";
import { useTopTabsHeader } from "@ui/top-tabs/lib/scroll-context";
import { useArticles } from "@modules/inbox/hooks/use-articles";
import type { ArticleListItemDto } from "@kyomi/reader/schemas/article";
import { feedItemTypography } from "@modules/inbox/lib/layout";
import { Item } from "../item";

const ESTIMATED_ROW_SIZE = 252;
const NEAR_END_THRESHOLD = 0.5;
const MIN_SKELETON_ROWS = 3;
const MAX_SKELETON_ROWS = 12;

export function List({ ListEmptyComponent }: { ListEmptyComponent: React.ReactElement }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { items, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useArticles();
  const header = useTopTabsHeader();
  const headerHeight = header?.headerHeight ?? 0;
  const tabBarOcclusionHeight = getTabBarOcclusionHeight(insets);
  const sharedValues = useMemo(
    () => (header ? { scrollOffset: header.scrollY } : undefined),
    [header],
  );
  const handleScrollBeginDrag = useCallback(() => {
    header?.hasUserInteracted.set(true);
  }, [header]);

  if (isLoading) {
    const { titleLineHeightPx, summaryLineHeightPx, metaFontSizePx } = feedItemTypography;
    const rowCount = height
      ? Math.max(
          MIN_SKELETON_ROWS,
          Math.min(MAX_SKELETON_ROWS, Math.ceil(height / ESTIMATED_ROW_SIZE) + 1),
        )
      : 6;

    return (
      <View style={{ paddingBottom: tabBarOcclusionHeight, paddingTop: headerHeight }}>
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
    return ListEmptyComponent;
  }

  const isIOS = Platform.OS === "ios";

  return (
    <AnimatedLegendList
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      contentContainerStyle={
        isIOS ? undefined : { paddingBottom: tabBarOcclusionHeight, paddingTop: headerHeight }
      }
      contentInset={isIOS ? { bottom: tabBarOcclusionHeight, top: headerHeight } : undefined}
      contentInsetAdjustmentBehavior="never"
      data={items}
      estimatedItemSize={ESTIMATED_ROW_SIZE}
      keyExtractor={(item: ArticleListItemDto) => item.id}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={NEAR_END_THRESHOLD}
      onScrollBeginDrag={handleScrollBeginDrag}
      sharedValues={sharedValues}
      scrollIndicatorInsets={
        isIOS ? { bottom: tabBarOcclusionHeight, top: headerHeight } : undefined
      }
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
        />
      )}
      recycleItems
    />
  );
}
