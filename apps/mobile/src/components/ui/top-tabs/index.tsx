import { BlurTargetView } from "expo-blur";
import {
  Children,
  isValidElement,
  useCallback,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAnimatedReaction, useSharedValue, type SharedValue } from "react-native-reanimated";
import { Pager } from "./atoms/pager";
import { TopTabsBar } from "./atoms/tab-bar";
import { HEADER_CONTENT_HEIGHT, Header } from "@ui/header";
import { HeaderSurface } from "@ui/header/surface";
import { usePager } from "./hooks/use-pager";
import { TopTabsHeaderContext, type TopTabsHeaderContextValue } from "./lib/scroll-context";
import type { TopTabsProps, TopTabsTabProps } from "./lib/types";

type TopTabsPageProps = PropsWithChildren<{
  headerHeight: number;
  index: number;
  scrollOffsets: SharedValue<number[]>;
}>;

function TopTabsPage({ children, headerHeight, index, scrollOffsets }: TopTabsPageProps) {
  const contentInsetTop = Platform.OS === "ios" ? headerHeight : 0;
  const pageScrollY = useSharedValue(-contentInsetTop);
  const hasUserInteracted = useSharedValue(contentInsetTop === 0);

  useAnimatedReaction(
    () => {
      const offset = pageScrollY.value;

      // Legend List initializes the same shared value with its logical
      // resting position (`0`). On iOS that is not the native scroll view's
      // resting offset (`-contentInsetTop`), so treating it as scroll would
      // fully materialize the header on a first horizontal tab swipe. Only
      // trust this value after a vertical interaction, then preserve the
      // actual offset when a previously scrolled page becomes active again.
      if (contentInsetTop > 0 && !hasUserInteracted.value) return 0;

      return Math.max(0, offset + contentInsetTop);
    },
    (offset) => {
      scrollOffsets.modify((offsets) => {
        offsets[index] = offset;
        return offsets;
      }, true);
    },
  );

  const headerContext = useMemo<TopTabsHeaderContextValue>(
    () => ({ hasUserInteracted, headerHeight, scrollY: pageScrollY }),
    [hasUserInteracted, headerHeight, pageScrollY],
  );

  return <TopTabsHeaderContext value={headerContext}>{children}</TopTabsHeaderContext>;
}

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
 * own scrollable content) and retain UI-thread scroll offsets so the header
 * material follows the page continuously as it scrolls beneath it. Compose with
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
  const tabs = Children.toArray(children).filter(isValidElement<TopTabsTabProps>);
  const tabNames = tabs.map((tab) => tab.props.name);
  const scrollOffsets = useSharedValue<number[]>(() => new Array(tabNames.length).fill(0));
  const headerScrollY = useSharedValue(0);
  const [focusedTabName, setFocusedTabName] = useState(
    () => (tabNames.includes(initialTabName) ? initialTabName : tabNames[0]) ?? "",
  );
  const blurTargetRef = useRef<View>(null);

  const setFocusedTab = useCallback(
    (name: string) => {
      const nextTabName = tabNames.includes(name) ? name : (tabNames[0] ?? "");
      setFocusedTabName(nextTabName);
    },
    [tabNames],
  );

  const onPageSettled = useCallback(
    (index: number) => {
      setFocusedTab(tabNames[index] ?? tabNames[0] ?? "");
    },
    [setFocusedTab, tabNames],
  );

  const { offsetX, listRef, indexDecimal, onLayout, onMomentumScrollEnd, onTabPress } = usePager({
    initialTabName,
    onPageSettled,
    tabNames,
  });

  useAnimatedReaction(
    () => {
      const offsets = scrollOffsets.value;
      const lastIndex = offsets.length - 1;
      if (lastIndex < 0) return 0;

      const activeIndex = Math.min(Math.max(indexDecimal.value, 0), lastIndex);
      const startIndex = Math.floor(activeIndex);
      const endIndex = Math.min(Math.ceil(activeIndex), lastIndex);
      const progress = activeIndex - startIndex;
      const startOffset = offsets[startIndex] ?? 0;
      const endOffset = offsets[endIndex] ?? startOffset;

      return startOffset + (endOffset - startOffset) * progress;
    },
    (offset) => {
      headerScrollY.value = offset;
    },
  );

  const handleTabPress = useCallback(
    (name: string) => {
      onTabPress(name);
    },
    [onTabPress],
  );

  const headerHeight = insets.top + HEADER_CONTENT_HEIGHT;

  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Pager
          listRef={listRef}
          offsetX={offsetX}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onViewportLayout={onLayout}
          tabNames={tabNames}
        >
          {tabs.map((tab, index) => (
            <TopTabsPage
              headerHeight={headerHeight}
              index={index}
              key={tab.props.name}
              scrollOffsets={scrollOffsets}
            >
              {tab.props.children}
            </TopTabsPage>
          ))}
        </Pager>
      </BlurTargetView>
      <HeaderSurface
        blurTarget={blurTargetRef}
        scrollY={headerScrollY}
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
      >
        <Header surface="transparent">
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
        </Header>
      </HeaderSurface>
    </View>
  );
}

TopTabs.Tab = TopTabsTab;
