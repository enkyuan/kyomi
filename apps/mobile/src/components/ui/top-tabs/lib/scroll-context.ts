import { createContext, useContext } from "react";
import type { SharedValue } from "react-native-reanimated";

export type TopTabsHeaderContextValue = {
  /**
   * The page-local native scroll offset. The tabs container normalizes each
   * page's inset and derives the header material from the pager's live position.
   */
  scrollY: SharedValue<number>;
  /**
   * iOS lists can publish a logical `0` while they are applying their native
   * top inset. Keep that setup value from being interpreted as content under
   * the header until the user has started a vertical interaction on the page.
   */
  hasUserInteracted: SharedValue<boolean>;
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
