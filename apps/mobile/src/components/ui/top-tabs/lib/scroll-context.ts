import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

export type TopTabsHeaderContextValue = {
  /**
   * The active page's vertical scroll offset, written to by whichever page is
   * currently visible. Drives the header's scroll-in blur.
   */
  scrollY: SharedValue<number>;
  /**
   * Height of the floating header (safe-area top inset + tab bar). Pages
   * render edge-to-edge behind it, so a page's own scrollable content should
   * apply this as a top content inset rather than a layout offset.
   */
  headerHeight: number;
};

export const TopTabsHeaderContext = createContext<TopTabsHeaderContextValue | null>(null);

export function useTopTabsHeader() {
  return useContext(TopTabsHeaderContext);
}
