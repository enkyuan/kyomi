import { LegendList } from "@legendapp/list/react-native";
import { router } from "expo-router";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import { Skeleton } from "@ui/skeleton";
import { useTopTabsHeader } from "@ui/top-tabs/lib/scroll-context";
import { useArticles } from "@modules/inbox/hooks/use-articles";
import type { ArticleListItem } from "@modules/inbox/lib/articles";
import { feedItemTypography } from "@modules/inbox/lib/layout";
import { Item } from "../item";

const ESTIMATED_ROW_SIZE = 252;
const NEAR_END_THRESHOLD = 0.5;
const MIN_SKELETON_ROWS = 3;
const MAX_SKELETON_ROWS = 12;

function SkeletonRow({ isFirst }: { isFirst: boolean }) {
  const { titleLineHeightPx, summaryLineHeightPx, metaFontSizePx } = feedItemTypography;

  return (
    <View className="relative">
      {!isFirst && <View className="absolute top-0 right-0 left-0 h-px bg-border/70" />}

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
  );
}

function SkeletonRows({
  headerHeight,
  viewportHeight,
}: {
  headerHeight: number;
  viewportHeight: number;
}) {
  const rowCount = viewportHeight
    ? Math.max(
        MIN_SKELETON_ROWS,
        Math.min(MAX_SKELETON_ROWS, Math.ceil(viewportHeight / ESTIMATED_ROW_SIZE) + 1),
      )
    : 6;

  return (
    <View style={{ paddingTop: headerHeight }}>
      {Array.from({ length: rowCount }).map((_, index) => (
        <SkeletonRow isFirst={index === 0} key={index} />
      ))}
    </View>
  );
}

export function List({ ListEmptyComponent }: { ListEmptyComponent: React.ReactElement }) {
  const { height } = useWindowDimensions();
  const { items, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useArticles();
  const header = useTopTabsHeader();
  const headerHeight = header?.headerHeight ?? 0;

  if (isLoading) {
    return <SkeletonRows headerHeight={headerHeight} viewportHeight={height} />;
  }

  if (items.length === 0) {
    return ListEmptyComponent;
  }

  const isIOS = Platform.OS === "ios";

  return (
    <LegendList
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      contentContainerStyle={isIOS ? undefined : { paddingTop: headerHeight }}
      contentInset={isIOS ? { top: headerHeight } : undefined}
      contentInsetAdjustmentBehavior="never"
      data={items}
      estimatedItemSize={ESTIMATED_ROW_SIZE}
      keyExtractor={(item: ArticleListItem) => item.id}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      onEndReachedThreshold={NEAR_END_THRESHOLD}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offset = isIOS
          ? event.nativeEvent.contentOffset.y + headerHeight
          : event.nativeEvent.contentOffset.y;
        header?.scrollY.set(Math.max(0, offset));
      }}
      scrollEventThrottle={16}
      scrollIndicatorInsets={isIOS ? { top: headerHeight } : undefined}
      renderItem={({ item, index }: { item: ArticleListItem; index: number }) => (
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
