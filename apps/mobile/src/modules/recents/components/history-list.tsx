import { AnimatedLegendList } from "@legendapp/list/reanimated";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, type ComponentRef } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SharedValue } from "react-native-reanimated";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { FeedFavicon } from "@modules/inbox/components/feed-favicon";
import { feedItemTypography } from "@modules/inbox/lib/layout";
import { formatInboxTimestamp } from "@modules/inbox/utils/format-timestamp";
import { getFeedSourceLabel } from "@modules/inbox/utils/source-label";
import type { RecentArticle } from "../lib/history";
import {
  getRecentHistoryInitialOffset,
  resetRecentHistoryScroll,
  type NativeScrollable,
} from "../lib/scroll-position";
import { useRecentArticles } from "../lib/store";

const ESTIMATED_ROW_SIZE = 116;

type RecentHistoryListProps = {
  headerHeight: number;
  onScrollBeginDrag: () => void;
  onScrollReset: () => void;
  scrollY: SharedValue<number>;
};

export function RecentHistoryList({
  headerHeight,
  onScrollBeginDrag,
  onScrollReset,
  scrollY,
}: RecentHistoryListProps) {
  const insets = useSafeAreaInsets();
  const articles = useRecentArticles();
  const tabBarOcclusionHeight = getTabBarOcclusionHeight(insets);
  const isIOS = Platform.OS === "ios";
  const initialScrollOffset = getRecentHistoryInitialOffset(headerHeight, isIOS);
  const listRef = useRef<ComponentRef<typeof AnimatedLegendList<RecentArticle>>>(null);
  const sharedValues = useMemo(() => ({ scrollOffset: scrollY }), [scrollY]);

  useFocusEffect(
    useCallback(() => {
      // Tab routes remain mounted. Recents is a chronological destination, so
      // each visit starts at the latest viewed item rather than restoring a
      // previous reading position.
      onScrollReset();
      scrollY.set(initialScrollOffset);
      resetRecentHistoryScroll(
        listRef.current?.getNativeScrollRef() as NativeScrollable | undefined,
        initialScrollOffset,
      );
    }, [initialScrollOffset, onScrollReset, scrollY]),
  );

  return (
    <AnimatedLegendList
      automaticallyAdjustContentInsets={false}
      automaticallyAdjustsScrollIndicatorInsets={false}
      contentContainerStyle={
        isIOS
          ? {
              flexGrow: articles.length === 0 ? 1 : undefined,
              paddingBottom: tabBarOcclusionHeight,
            }
          : {
              flexGrow: articles.length === 0 ? 1 : undefined,
              paddingBottom: tabBarOcclusionHeight,
              paddingTop: headerHeight,
            }
      }
      contentInset={isIOS ? { bottom: tabBarOcclusionHeight, top: headerHeight } : undefined}
      contentInsetAdjustmentBehavior="never"
      data={articles}
      estimatedItemSize={ESTIMATED_ROW_SIZE}
      initialScrollOffset={isIOS ? initialScrollOffset : undefined}
      keyExtractor={(article) => article.id}
      ListEmptyComponent={<RecentHistoryEmptyState />}
      onScrollBeginDrag={onScrollBeginDrag}
      renderItem={({ item, index }: { item: RecentArticle; index: number }) => (
        <RecentHistoryItem article={item} isFirst={index === 0} />
      )}
      recycleItems
      ref={listRef}
      scrollIndicatorInsets={
        isIOS ? { bottom: tabBarOcclusionHeight, top: headerHeight } : undefined
      }
      sharedValues={sharedValues}
    />
  );
}

function RecentHistoryItem({ article, isFirst }: { article: RecentArticle; isFirst: boolean }) {
  const { metaFontSizePx, titleFontSizePx, titleLineHeightPx } = feedItemTypography;
  const sourceLabel = getFeedSourceLabel(article.link, article.feedTitle);
  const viewedLabel = `Viewed ${formatInboxTimestamp(article.viewedAt)}`;

  return (
    <View className="relative">
      {!isFirst ? <View className="absolute top-0 right-0 left-0 h-px bg-border/70" /> : null}
      <Pressable
        accessibilityLabel={`${article.title}. ${viewedLabel}`}
        accessibilityRole="button"
        className="active:opacity-70"
        onPress={() =>
          router.push({
            pathname: "/(protected)/(tabs)/(inbox)/[article]",
            params: { article: article.id },
          })
        }
      >
        <View className="gap-3 px-5 py-5">
          <View className="min-w-0 flex-row items-center gap-3">
            <FeedFavicon
              faviconUrl={article.feedFaviconUrl}
              feedUrl={article.feedUrl ?? article.link}
              siteUrl={article.feedSiteUrl}
              size={22}
              title={article.feedTitle}
            />
            <Text
              className="min-w-0 flex-1 font-medium text-muted-foreground/95"
              numberOfLines={1}
              style={{ fontSize: metaFontSizePx }}
            >
              {sourceLabel}
            </Text>
          </View>
          <Text
            className="font-semibold text-foreground"
            numberOfLines={2}
            style={{ fontSize: titleFontSizePx, lineHeight: titleLineHeightPx }}
          >
            {article.title}
          </Text>
          <Text
            className="font-medium text-muted-foreground/80"
            style={{ fontSize: metaFontSizePx }}
          >
            {viewedLabel}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function RecentHistoryEmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8 pb-24">
      <Text className="text-center text-lg font-semibold text-foreground">
        No recently viewed articles
      </Text>
      <Text className="mt-2 text-center text-sm leading-5 text-muted-foreground">
        Open a feed item to keep it here for later.
      </Text>
    </View>
  );
}
