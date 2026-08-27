import type { EdgeInsets } from "react-native-safe-area-context";

export const SEPARATE_ACTION_WIDTH = 56;
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

function getFloatingBarOcclusionHeight(insets: FloatingBarInsets, barHeight: number) {
  return getFloatingBarPosition(insets).bottom + barHeight + FLOATING_BAR_CONTENT_GUTTER;
}

export function getTabBarOcclusionHeight(insets: FloatingBarInsets) {
  return getFloatingBarOcclusionHeight(insets, TAB_BAR_HEIGHT);
}

export function getReaderTabBarOcclusionHeight(insets: FloatingBarInsets) {
  return getFloatingBarOcclusionHeight(insets, READER_TAB_BAR_HEIGHT);
}
