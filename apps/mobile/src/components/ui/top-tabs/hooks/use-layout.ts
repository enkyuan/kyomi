import { useEffect, useState } from "react";
import { useSharedValue } from "react-native-reanimated";

type Props = {
  tabCount: number;
  sidePadding: number;
  gap: number;
};

/**
 * Measures tab widths (reported via onLayout) and derives each tab's left
 * offset, so a sliding indicator can be positioned without a second layout pass.
 *
 * Widths are tracked in React state rather than purely on a shared value:
 * a shared value written from `onLayout` (a JS-thread callback firing once
 * per tab, well after mount) never reliably reaches `useAnimatedStyle`'s
 * mapper on this Reanimated build once the app is idle, since nothing else
 * requests a fresh UI frame at that point. Routing the write through a
 * render effect guarantees the derived shared values actually update.
 */
export function useTabBarLayout({ tabCount, sidePadding, gap }: Props) {
  const [widths, setWidths] = useState<number[]>(() => new Array(tabCount).fill(0));

  const tabWidths = useSharedValue<number[]>(widths);
  const tabOffsets = useSharedValue<number[]>(
    Array.from({ length: tabCount }, (_, index) => sidePadding + index * gap),
  );

  useEffect(() => {
    setWidths((previous) =>
      previous.length === tabCount
        ? previous
        : Array.from({ length: tabCount }, (_, index) => previous[index] ?? 0),
    );
  }, [tabCount]);

  useEffect(() => {
    if (widths.length !== tabCount) return;

    tabWidths.value = widths;

    const offsets = new Array<number>(widths.length);
    let currentOffset = sidePadding;
    for (let index = 0; index < widths.length; index += 1) {
      offsets[index] = currentOffset;
      currentOffset += widths[index] + gap;
    }
    tabOffsets.value = offsets;
  }, [widths, tabCount, sidePadding, gap, tabWidths, tabOffsets]);

  function onTabLayout(index: number, width: number) {
    setWidths((previous) => {
      if (previous[index] === width) return previous;
      const next = previous.slice();
      next[index] = width;
      return next;
    });
  }

  return { tabWidths, tabOffsets, onTabLayout };
}
