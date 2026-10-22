import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { ArticleListView } from "../../../../modules/article-list";
import { useNativeListSync } from "@modules/articles/hooks/use-native-list-sync";
import { useArticleListStyle } from "@modules/articles/lib/list-style";
import { toRecentRow } from "../lib/rows";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import {
  useOptionalTabBarMinimize,
  useTabBarMinimizeNativeScroll,
} from "@ui/tab-bar/hooks/use-minimize";
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
  const listRef = useNativeListSync(rows);
  const tabBarOcclusionHeight = getTabBarOcclusionHeight(insets);
  const listStyle = useArticleListStyle();
  const resetTabBarMinimize = useOptionalTabBarMinimize()?.reset;
  // Set once the list leaves its resting offset, so `onScrollBeginDrag` crosses to JS once per visit
  // rather than on every scroll frame.
  const hasLeftRest = useSharedValue(false);
  // Without a header of our own (pushed under a native stack header) UIKit insets the list itself.
  const insetsAutomatically = headerHeight === 0;
  const [scrollToTopToken, setScrollToTopToken] = useState(0);

  useFocusEffect(
    useCallback(() => {
      // Tab routes remain mounted. Recents is a chronological destination, so each visit starts at
      // the latest viewed item rather than restoring a previous reading position.
      onScrollReset();
      resetTabBarMinimize?.();
      hasLeftRest.set(false);
      if (insetsAutomatically) return;
      scrollY.set(-headerHeight);
      setScrollToTopToken((token) => token + 1);
    }, [
      hasLeftRest,
      headerHeight,
      insetsAutomatically,
      onScrollReset,
      resetTabBarMinimize,
      scrollY,
    ]),
  );

  const handleRestOffset = useCallback(
    (y: number) => {
      "worklet";
      if (hasLeftRest.get() || Math.abs(y + headerHeight) <= 1) return;
      hasLeftRest.set(true);
      scheduleOnRN(onScrollBeginDrag);
    },
    [hasLeftRest, headerHeight, onScrollBeginDrag],
  );
  const handleScroll = useTabBarMinimizeNativeScroll(scrollY, { onScroll: handleRestOffset });

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
      ref={listRef}
      scrollIndicatorInset={{ bottom: tabBarOcclusionHeight, top: headerHeight }}
      scrollToTopToken={scrollToTopToken}
      style={{ flex: 1 }}
    />
  );
}
