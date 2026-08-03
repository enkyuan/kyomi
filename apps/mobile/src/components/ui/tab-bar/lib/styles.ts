import { StyleSheet } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

const SEPARATE_WIDTH = 72;
const READER_SEPARATE_WIDTH = 72;
const FLOATING_BAR_SIDE_GUTTER = 20;
const FLOATING_BAR_EDGE_GUTTER = 20;
const FLOATING_BAR_SAFE_AREA_TAIL_OVERLAP = 12;
const FLOATING_BAR_CONTENT_GUTTER = 12;

export const TAB_BAR_HEIGHT = 56;
export const READER_TAB_BAR_HEIGHT = 56;

type FloatingBarInsets = Pick<EdgeInsets, "bottom" | "left" | "right">;

type FloatingBarPosition = {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
};

/**
 * The custom tab bar is already absolutely positioned against the navigator's
 * physical lower edge. Let the visual edge gutter do the optical alignment,
 * while retaining the upper portion of a large Android navigation inset.
 */
export function getFloatingBarPosition(insets: FloatingBarInsets): FloatingBarPosition {
  const horizontalInset = Math.max(insets.left, insets.right) + FLOATING_BAR_SIDE_GUTTER;

  return {
    bottom: Math.max(FLOATING_BAR_EDGE_GUTTER, insets.bottom - FLOATING_BAR_SAFE_AREA_TAIL_OVERLAP),
    left: horizontalInset,
    right: horizontalInset,
  };
}

export function getFloatingBarWidth(windowWidth: number, insets: FloatingBarInsets) {
  const { left, right } = getFloatingBarPosition(insets);
  return Math.max(0, windowWidth - left - right);
}

function getFloatingBarOcclusionHeight(insets: FloatingBarInsets, barHeight: number) {
  return getFloatingBarPosition(insets).bottom + barHeight + FLOATING_BAR_CONTENT_GUTTER;
}

export function getTabBarOcclusionHeight(insets: FloatingBarInsets) {
  return getFloatingBarOcclusionHeight(insets, TAB_BAR_HEIGHT);
}

export function getReaderTabBarOcclusionHeight(insets: FloatingBarInsets) {
  return getFloatingBarOcclusionHeight(insets, READER_TAB_BAR_HEIGHT);
}

export const styles = StyleSheet.create({
  row: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  wrapper: {
    flex: 1,
    borderRadius: 32,
    overflow: "hidden",
  },
  separateWrapper: {
    width: SEPARATE_WIDTH,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  primarySurface: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: 32,
  },
  separateSurface: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: TAB_BAR_HEIGHT / 2,
  },
  bar: {
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
  },
  separateBar: {
    flex: 1,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 200,
    margin: 6,
    position: "relative",
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 200,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  readerRow: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liquidHost: {
    position: "absolute",
    height: TAB_BAR_HEIGHT,
  },
  liquidHostedContent: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  liquidPrimaryGroup: {
    flex: 1,
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
  },
  liquidSeparateGroup: {
    flex: 1,
  },
  readerWrapper: {
    flex: 1,
    minWidth: 0,
    height: READER_TAB_BAR_HEIGHT,
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  readerSurface: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
  },
  readerBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  readerAction: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    margin: 4,
  },
  readerActionPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  readerSearchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  readerSearchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    color: "#f4f4f5",
    fontSize: 14,
  },
  readerSearchCloseAction: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  readerSeparateWrapper: {
    width: READER_SEPARATE_WIDTH,
    height: READER_TAB_BAR_HEIGHT,
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  readerSeparateSurface: {
    width: READER_SEPARATE_WIDTH,
    height: READER_TAB_BAR_HEIGHT,
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
  },
  readerSeparateAction: {
    width: READER_SEPARATE_WIDTH,
    height: READER_TAB_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: READER_TAB_BAR_HEIGHT / 2,
  },
});
