import { Children, isValidElement, useCallback, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { HeaderSurface } from "./atoms/header-surface";
import { Pager } from "./atoms/pager";
import { TAB_BAR_HEIGHT, TopTabsBar } from "./atoms/tab-bar";
import { usePager } from "./hooks/use-pager";
import { TopTabsHeaderContext } from "./lib/scroll-context";
import type { TopTabsProps, TopTabsTabProps } from "./lib/types";

/**
 * Wrap each page's content with `TopTabs.Tab`. Purely a marker component —
 * `TopTabs` reads `name`/`children` off each element and never renders it directly.
 */
function TopTabsTab({ children }: TopTabsTabProps) {
  return children;
}

/**
 * A swipeable top tab bar: a scrollable, self-centering row with a sliding
 * indicator, wired to a paging horizontal list. Swiping and tapping both
 * drive the same scroll offset, so the bar and pages stay in sync. The bar
 * floats over the pager, invisible at rest — pages render edge-to-edge
 * beneath it (see `useTopTabsHeader` for the inset a page should apply to its
 * own scrollable content) and report scroll position back so the header
 * fades in a blur as that page scrolls beneath it. Compose with
 * `TopTabs.Tab`.
 *
 * ```tsx
 * <TopTabs initialTabName="All">
 *   <TopTabs.Tab name="All"><AllScreen /></TopTabs.Tab>
 *   <TopTabs.Tab name="Saved"><SavedScreen /></TopTabs.Tab>
 * </TopTabs>
 * ```
 */
export function TopTabs({
  initialTabName,
  children,
  sidePadding,
  gap,
  tabClassName,
  labelClassName,
  indicatorClassName,
}: TopTabsProps) {
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const tabs = Children.toArray(children).filter(isValidElement<TopTabsTabProps>);
  const tabNames = tabs.map((tab) => tab.props.name);
  const [focusedTabName, setFocusedTabName] = useState(
    () => (tabNames.includes(initialTabName) ? initialTabName : tabNames[0]) ?? "",
  );

  const onPageSettled = useCallback(
    (index: number) => {
      scrollY.set(0);
      setFocusedTabName(tabNames[index] ?? tabNames[0] ?? "");
    },
    [scrollY, tabNames],
  );

  const { offsetX, listRef, indexDecimal, onLayout, onMomentumScrollEnd, onTabPress } = usePager({
    initialTabName,
    onPageSettled,
    tabNames,
  });

  const handleTabPress = useCallback(
    (name: string) => {
      setFocusedTabName(name);
      onTabPress(name);
    },
    [onTabPress],
  );

  const headerHeight = insets.top + TAB_BAR_HEIGHT;

  return (
    <TopTabsHeaderContext value={{ scrollY, headerHeight }}>
      <View style={{ flex: 1 }}>
        <Pager
          listRef={listRef}
          offsetX={offsetX}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onViewportLayout={onLayout}
          tabNames={tabNames}
        >
          {tabs.map((tab) => tab.props.children)}
        </Pager>
        <HeaderSurface
          scrollY={scrollY}
          style={{ position: "absolute", top: 0, left: 0, right: 0 }}
        >
          <View style={{ height: insets.top }} />
          <TopTabsBar
            focusedTabName={focusedTabName}
            gap={gap}
            indexDecimal={indexDecimal}
            indicatorClassName={indicatorClassName}
            labelClassName={labelClassName}
            onTabPress={handleTabPress}
            sidePadding={sidePadding}
            tabClassName={tabClassName}
            tabNames={tabNames}
          />
        </HeaderSurface>
      </View>
    </TopTabsHeaderContext>
  );
}

TopTabs.Tab = TopTabsTab;
