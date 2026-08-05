import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, { type SharedValue, useAnimatedScrollHandler } from "react-native-reanimated";

type Props = {
  tabNames: string[];
  children: React.ReactNode[];
  offsetX: SharedValue<number>;
  listRef: React.RefObject<Animated.FlatList<string> | null>;
  onViewportLayout: (width: number) => void;
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

/**
 * A paging horizontal list, one page per tab. Uses the native ScrollView's
 * own paging rather than a hand-rolled pan gesture — the native gesture
 * already coordinates with vertical scrolling inside each page, and its
 * scroll offset (mirrored into `offsetX`) is what drives the tab bar. Pages
 * render edge-to-edge; each page applies its own top content inset (see
 * `useTopTabsHeader`) so its content can scroll beneath the floating header.
 */
export function Pager({
  tabNames,
  children,
  offsetX,
  listRef,
  onViewportLayout,
  onMomentumScrollEnd,
}: Props) {
  const { width } = useWindowDimensions();

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      offsetX.value = event.contentOffset.x;
    },
  });

  return (
    <Animated.FlatList
      ref={listRef}
      // Animated FlatList does not participate in Uniwind's layout resolution
      // reliably. Keep the pager's hit area explicit so its native horizontal
      // pan recognizer receives the swipe.
      style={{ flex: 1 }}
      data={tabNames}
      keyExtractor={(item) => item}
      // Match the X reference: a pager item has one concrete viewport width.
      // Giving a horizontal list item `flex: 1` makes the native scroll view
      // compete with the parent for its main-axis size and can prevent a pan
      // from producing a distinct next page.
      renderItem={({ index }) => <View style={{ width }}>{children[index]}</View>}
      getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
      horizontal
      pagingEnabled
      scrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      onScroll={scrollHandler}
      scrollEventThrottle={1000 / 60}
      onLayout={(event) => onViewportLayout(event.nativeEvent.layout.width)}
      onMomentumScrollEnd={onMomentumScrollEnd}
    />
  );
}
