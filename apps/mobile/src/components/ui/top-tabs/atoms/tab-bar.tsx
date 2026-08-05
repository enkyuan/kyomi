import { useWindowDimensions, View } from "react-native";
import Reanimated, {
  interpolate,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnUI } from "react-native-worklets";
import type { TopTabsBarProps } from "../lib/types";
import { useTabBarLayout } from "../hooks/use-layout";
import { TabIndicator } from "./tab-indicator";
import { TabItem } from "./tab-item";

const DEFAULT_SIDE_PADDING = 16;
const DEFAULT_GAP = 24;
export const TAB_BAR_HEIGHT = 48;

function setPressedTab(
  indexDecimal: SharedValue<number>,
  pressStartIndex: SharedValue<number>,
  pressEndIndex: SharedValue<number | null>,
  nextIndex: number,
) {
  "worklet";

  const currentIndex = indexDecimal.value;
  if (Math.abs(currentIndex - nextIndex) < Number.EPSILON) return;

  pressStartIndex.value = currentIndex;
  pressEndIndex.value = nextIndex;
}

/**
 * A horizontally scrollable, self-centering top tab bar with a sliding
 * indicator. Its label emphasis follows the pager continuously during swipes.
 */
export function TopTabsBar({
  focusedTabName,
  indexDecimal,
  onTabPress,
  tabNames,
  sidePadding = DEFAULT_SIDE_PADDING,
  gap = DEFAULT_GAP,
  tabClassName = "text-lg font-medium",
  labelClassName,
  indicatorClassName,
}: TopTabsBarProps) {
  const { width: viewportWidth } = useWindowDimensions();

  const listRef = useAnimatedRef<Reanimated.FlatList<string>>();
  const tabBarOffsetX = useSharedValue(0);
  const pressStartIndex = useSharedValue(0);
  const pressEndIndex = useSharedValue<number | null>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      tabBarOffsetX.value = event.contentOffset.x;
    },
  });

  const { tabWidths, tabOffsets, onTabLayout } = useTabBarLayout({
    tabCount: tabNames.length,
    sidePadding,
    gap,
  });

  useAnimatedReaction(
    () => ({
      activeIndex: indexDecimal.value,
      offsets: tabOffsets.value,
      pressedIndex: pressEndIndex.value,
      pressStartedAt: pressStartIndex.value,
      widths: tabWidths.value,
    }),
    ({ activeIndex, offsets, pressedIndex, pressStartedAt, widths }) => {
      const tabCount = widths.length;

      if (tabCount === 0 || offsets.length !== tabCount) return;

      const tabCenters = new Array<number>(tabCount);
      const inputRange = new Array<number>(tabCount);
      let firstCenterableIndex = -1;

      for (let index = 0; index < tabCount; index += 1) {
        if (widths[index] === 0) return;

        const center = offsets[index] + widths[index] / 2;
        tabCenters[index] = center;
        inputRange[index] = index;

        if (firstCenterableIndex === -1 && center > viewportWidth / 2) {
          firstCenterableIndex = index;
        }
      }

      if (tabCount === 1) {
        scrollTo(listRef, 0, 0, false);
        return;
      }

      const outputRange = new Array<number>(tabCount);
      for (let index = 0; index < tabCount; index += 1) {
        outputRange[index] =
          firstCenterableIndex === -1 || index < firstCenterableIndex
            ? 0
            : tabCenters[index] - viewportWidth / 2;
      }

      const hasValidPressedIndex =
        pressedIndex !== null &&
        pressStartedAt >= 0 &&
        pressStartedAt < tabCount &&
        pressedIndex >= 0 &&
        pressedIndex < tabCount &&
        pressStartedAt !== pressedIndex;

      const offsetX = hasValidPressedIndex
        ? interpolate(
            activeIndex,
            [pressStartedAt, pressedIndex],
            [outputRange[pressStartedAt], outputRange[pressedIndex]],
          )
        : interpolate(activeIndex, inputRange, outputRange);

      scrollTo(listRef, offsetX, 0, false);

      if (pressedIndex !== null && activeIndex === pressedIndex) {
        pressEndIndex.value = null;
      }
    },
  );

  function renderItem({ item, index }: { item: string; index: number }) {
    function onPress() {
      scheduleOnUI(setPressedTab, indexDecimal, pressStartIndex, pressEndIndex, index);
      onTabPress(item);
    }

    return (
      <TabItem
        className={labelClassName ?? tabClassName}
        isFocused={focusedTabName === item}
        key={item}
        name={item}
        onLayout={(width) => onTabLayout(index, width)}
        onPress={onPress}
      />
    );
  }

  return (
    <View className="pb-2" style={{ height: TAB_BAR_HEIGHT }}>
      <Reanimated.FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={tabNames}
        keyExtractor={(item) => String(item)}
        renderItem={renderItem}
        horizontal
        contentContainerStyle={{ paddingHorizontal: sidePadding, gap }}
        showsHorizontalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={1000 / 60}
      />
      <TabIndicator
        activeTabIndex={indexDecimal}
        tabWidths={tabWidths}
        tabOffsets={tabOffsets}
        tabBarOffsetX={tabBarOffsetX}
        className={indicatorClassName}
      />
    </View>
  );
}
