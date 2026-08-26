import { useEffect, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTabBarTopEdgeOffset } from "@ui/tab-bar/lib/styles";
import { TAB_BAR_HEIGHT as TOP_TABS_HEIGHT } from "@ui/top-tabs/atoms/tab-bar";
import { engine } from "../lib/manager";

/**
 * Synchronizes the native toast overlay with Kyomi's floating chrome.
 *
 * Native toast containers already apply an 8pt optical edge gap after their
 * supplied safe area. Supplying the chrome edges themselves therefore leaves
 * that same small, intentional clearance below top tabs and above the tab bar.
 */
export function ToastViewport() {
  const insets = useSafeAreaInsets();
  const safeArea = useMemo(
    () => ({
      bottom: getTabBarTopEdgeOffset(insets),
      top: insets.top + TOP_TABS_HEIGHT,
    }),
    [insets.bottom, insets.left, insets.right, insets.top],
  );

  useEffect(() => {
    void engine.setDefaults({ safeArea });
  }, [safeArea]);

  return null;
}
