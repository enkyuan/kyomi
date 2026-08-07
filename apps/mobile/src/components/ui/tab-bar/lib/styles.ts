import { StyleSheet } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";

export const SEPARATE_ACTION_WIDTH = 72;
const READER_SEPARATE_WIDTH = 72;
const FLOATING_BAR_SAFE_AREA_TAIL_OVERLAP = 12;
const FLOATING_BAR_CONTENT_GUTTER = 12;

export const TAB_BAR_HEIGHT = 56;
const FLOATING_BAR_RADIUS = TAB_BAR_HEIGHT / 2;
const FALLBACK_SCREEN_CORNER_RADIUS = TAB_BAR_HEIGHT;
/** Standard glyph size for the root tab bar, including the add action. */
export const TAB_BAR_ICON_SIZE = 24;
export const READER_TAB_BAR_HEIGHT = 56;

type FloatingBarInsets = Pick<EdgeInsets, "bottom" | "left" | "right">;

export type FloatingBarPosition = {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
};

/** Physical lower display corners measured by the native platform. */
export type BottomScreenCornerRadii = {
  readonly bottomLeft: number;
  readonly bottomRight: number;
};

function getConcentricInset(radius: number | undefined) {
  return Math.max(0, (radius ?? FALLBACK_SCREEN_CORNER_RADIUS) - FLOATING_BAR_RADIUS);
}

/**
 * Insets each lower capsule edge by the difference between the display's
 * corner radius and the capsule radius. That makes the two arcs concentric.
 * A persistent Android navigation bar may require a larger safe-area inset.
 */
export function getFloatingBarPosition(
  insets: FloatingBarInsets,
  screenCorners?: BottomScreenCornerRadii,
): FloatingBarPosition {
  const bottomInset = getConcentricInset(
    screenCorners ? Math.min(screenCorners.bottomLeft, screenCorners.bottomRight) : undefined,
  );

  return {
    // A capsule's lower radius plus this inset equals the screen's lower
    // radius. The safety guard only takes over for a persistent Android nav bar.
    bottom: Math.max(bottomInset, insets.bottom - FLOATING_BAR_SAFE_AREA_TAIL_OVERLAP),
    left: Math.max(insets.left, getConcentricInset(screenCorners?.bottomLeft)),
    right: Math.max(insets.right, getConcentricInset(screenCorners?.bottomRight)),
  };
}

export function getFloatingBarWidth(
  windowWidth: number,
  insets: FloatingBarInsets,
  screenCorners?: BottomScreenCornerRadii,
) {
  const { left, right } = getFloatingBarPosition(insets, screenCorners);
  return Math.max(0, windowWidth - left - right);
}

function getFloatingBarOcclusionHeight(insets: FloatingBarInsets, barHeight: number) {
  return getFloatingBarPosition(insets).bottom + barHeight + FLOATING_BAR_CONTENT_GUTTER;
}

export function getTabBarOcclusionHeight(insets: FloatingBarInsets) {
  return getFloatingBarOcclusionHeight(insets, TAB_BAR_HEIGHT);
}

/**
 * Distance from the physical bottom edge to the top of the standard floating
 * tab bar. Overlay surfaces use this as their minimum inset, then apply their
 * own visual clearance rather than inheriting scroll-content padding.
 */
export function getTabBarTopEdgeOffset(insets: FloatingBarInsets) {
  return getFloatingBarPosition(insets).bottom + TAB_BAR_HEIGHT;
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
    borderRadius: FLOATING_BAR_RADIUS,
    overflow: "hidden",
  },
  separateWrapper: {
    width: SEPARATE_ACTION_WIDTH,
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: "hidden",
  },
  primarySurface: {
    flex: 1,
    width: "100%",
    height: "100%",
    borderRadius: FLOATING_BAR_RADIUS,
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
  liquidContentLayer: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  liquidIconSwap: {
    width: 19,
    height: 19,
  },
  liquidIconSwapLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
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
  readerSearchContent: {
    flex: 1,
    width: "100%",
    height: "100%",
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
