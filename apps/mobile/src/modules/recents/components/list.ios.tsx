import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { type NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SharedValue } from "react-native-reanimated";
import { ArticleListView } from "../../../../modules/article-list";
import { useArticleListStyle } from "@ui/native-list/style";
import { toRecentRow } from "@ui/native-list/rows";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { useOptionalTabBarMinimize, useTabBarMinimizeOffset } from "@ui/tab-bar/hooks/use-minimize";
import { filterRecentArticles, type RecentRange } from "../lib/range";
import { useRecentArticles } from "../lib/store";
import { RecentHistoryEmptyState } from "./empty-state";

type RecentListProps = {
  headerHeight: number;
  onScrollBeginDrag: () => void;
  onScrollReset: () => void;
  range?: RecentRange;
  scrollY: SharedValue<number>;
};

/** Recents as a native list of SwiftUI rows, so a long history never mounts more than it shows. */
export function RecentList({
  headerHeight,
  onScrollBeginDrag,
  onScrollReset,
  range = "all",
  scrollY,
}: RecentListProps) {
  const insets = useSafeAreaInsets();
  const allArticles = useRecentArticles();
  const articles = useMemo(() => filterRecentArticles(allArticles, range), [allArticles, range]);
  const rows = useMemo(() => articles.map(toRecentRow), [articles]);
  const tabBarOcclusionHeight = getTabBarOcclusionHeight(insets);
  const listStyle = useArticleListStyle();
  const resetTabBarMinimize = useOptionalTabBarMinimize()?.reset;
  const minimizeOffset = useTabBarMinimizeOffset(scrollY);
  // Without a header of our own (pushed under a native stack header) UIKit insets the list itself.
  const insetsAutomatically = headerHeight === 0;
  const [scrollToTopToken, setScrollToTopToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      // Tab routes remain mounted. Recents is a chronological destination, so each visit starts at
      // the latest viewed item rather than restoring a previous reading position.
      onScrollReset();
      resetTabBarMinimize?.();
      if (insetsAutomatically) return;
      scrollY.set(-headerHeight);
      setScrollToTopToken((token) => token + 1);
    }, [headerHeight, insetsAutomatically, onScrollReset, resetTabBarMinimize, scrollY]),
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<{ y: number }>) => {
      const { y } = event.nativeEvent;
      if (Math.abs(y + headerHeight) > 1) onScrollBeginDrag();
      minimizeOffset(y);
    },
    [headerHeight, minimizeOffset, onScrollBeginDrag],
  );

  if (rows.length === 0) {
    return <RecentHistoryEmptyState />;
  }

  return (
    <ArticleListView
      adjustsInsetsAutomatically={insetsAutomatically}
      contentInset={{ bottom: tabBarOcclusionHeight, top: headerHeight }}
      listStyle={listStyle}
      onRowPress={({ nativeEvent }) =>
        router.push({
          pathname: "/(protected)/(tabs)/(inbox)/[article]",
          params: { article: nativeEvent.id },
        })
      }
      onScroll={handleScroll}
      rows={rows}
      scrollIndicatorInset={{ bottom: tabBarOcclusionHeight, top: headerHeight }}
      scrollToTopToken={scrollToTopToken}
      style={{ flex: 1 }}
    />
  );
}
