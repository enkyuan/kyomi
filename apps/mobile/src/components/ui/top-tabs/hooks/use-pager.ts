import { useCallback, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import type Animated from "react-native-reanimated";
import { useAnimatedReaction, useSharedValue } from "react-native-reanimated";
import { triggerSelectionHaptic } from "@/utils/haptics";

type Props = {
  tabNames: string[];
  initialTabName: string;
  onPageSettled: (index: number) => void;
};

/**
 * Owns the pager's position state: the paging list's raw `offsetX` (written
 * by its scroll handler) and the measured `viewportWidth` it's relative to,
 * plus `indexDecimal` (continuous, so the indicator tracks a swipe in
 * progress). The selected tab belongs in React state, which updates only when
 * a page settles and can therefore be read safely during render.
 */
export function usePager({ tabNames, initialTabName, onPageSettled }: Props) {
  const offsetX = useSharedValue(0);
  const viewportWidth = useSharedValue(0);
  const listRef = useRef<Animated.FlatList<string> | null>(null);
  const hasLaidOut = useRef(false);
  const pageWidthRef = useRef(0);
  const settledIndexRef = useRef(Math.max(tabNames.indexOf(initialTabName), 0));

  // `useDerivedValue` runs its initializer while React renders. Keep this
  // calculation in a UI-thread reaction so Reanimated strict mode never reads
  // a shared value during render, while the indicator remains continuous.
  const indexDecimal = useSharedValue(0);
  useAnimatedReaction(
    () => (viewportWidth.value > 0 ? offsetX.value / viewportWidth.value : 0),
    (nextIndexDecimal) => {
      indexDecimal.value = nextIndexDecimal;
    },
  );

  const onLayout = useCallback(
    (width: number) => {
      if (width <= 0) return;

      viewportWidth.set(width);
      pageWidthRef.current = width;
      // The list starts at offset 0 regardless of which tab is initial; jump
      // to the real initial page once the viewport width is known.
      if (!hasLaidOut.current) {
        hasLaidOut.current = true;
        const initialIndex = tabNames.indexOf(initialTabName);
        if (initialIndex > 0) {
          listRef.current?.scrollToOffset({ offset: initialIndex * width, animated: false });
        }
      }
    },
    [initialTabName, tabNames, viewportWidth],
  );

  const onTabPress = useCallback(
    (name: string) => {
      const index = tabNames.indexOf(name);
      if (index === -1 || pageWidthRef.current <= 0) return;
      listRef.current?.scrollToOffset({ offset: index * pageWidthRef.current, animated: true });
    },
    [tabNames],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const pageWidth = pageWidthRef.current;
      if (pageWidth <= 0 || tabNames.length === 0) return;

      const index = Math.min(
        Math.max(Math.round(event.nativeEvent.contentOffset.x / pageWidth), 0),
        tabNames.length - 1,
      );

      const didChangeSelection = settledIndexRef.current !== index;
      settledIndexRef.current = index;
      if (didChangeSelection) void triggerSelectionHaptic();

      onPageSettled(index);
    },
    [onPageSettled, tabNames.length],
  );

  return {
    offsetX,
    viewportWidth,
    listRef,
    indexDecimal,
    onLayout,
    onTabPress,
    onMomentumScrollEnd,
  };
}
