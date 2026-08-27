import { Dimensions, Platform } from "react-native";
import { interpolate } from "react-native-reanimated";

// --- Layout ---

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const TAB_BAR_HORIZONTAL_PADDING = 16;
export const TAB_BAR_GAP = 36;

export const PILL_HEIGHT = Platform.select({ android: 56, default: 52 });
export const SEARCH_ACTIVE_HEIGHT = Platform.select({ android: 48, default: 44 });
export const PILL_BORDER_RADIUS = PILL_HEIGHT / 2;
export const SEARCH_ACTIVE_RADIUS = SEARCH_ACTIVE_HEIGHT / 2;

// The 25 pt image-set canvas includes visible padding. The first two glyphs
// render at 28 pt; the selector retains its 25 pt optical size.
export const PRIMARY_TAB_ICON_SIZE = 28;
export const SELECTOR_TAB_ICON_SIZE = 25;
export const SEARCH_ICON_SIZE = 25;
export const ICON_PADDING = 4;

export const SEARCH_BUTTON_SIZE = 52;
export const SEARCH_BAR_RADIUS = PILL_BORDER_RADIUS;

export const TOTAL_WIDTH = SCREEN_WIDTH - 2 * TAB_BAR_HORIZONTAL_PADDING;
export const CLOSE_BUTTON_SIZE = SEARCH_ACTIVE_HEIGHT;
export const SEARCH_BAR_WIDTH = TOTAL_WIDTH - CLOSE_BUTTON_SIZE;

export const TAB_BAR_BOTTOM_PADDING = Platform.select({ android: 16, default: 12 });

// --- Tab Zone Constants (Tabs 1 & 2 regular width, Tab 3 selector at 0.6x width) ---

const MAX_PILL_WIDTH = TOTAL_WIDTH - TAB_BAR_GAP - SEARCH_BUTTON_SIZE;
const FULL_USABLE_PILL_WIDTH = MAX_PILL_WIDTH - 2 * ICON_PADDING;
const TAB_WIDTH_SCALE = 0.8;

export const SELECTOR_RATIO = 0.6;
export const REGULAR_TAB_WIDTH = (FULL_USABLE_PILL_WIDTH / (2 + SELECTOR_RATIO)) * TAB_WIDTH_SCALE;
export const SELECTOR_TAB_WIDTH = REGULAR_TAB_WIDTH * SELECTOR_RATIO;
export const PILL_WIDTH = 2 * ICON_PADDING + 2 * REGULAR_TAB_WIDTH + SELECTOR_TAB_WIDTH;
export const TAB_ITEM_HEIGHT = PILL_HEIGHT - 8;
export const TAB_ITEM_RADIUS = TAB_ITEM_HEIGHT / 2;

export const TAB_WIDTHS = [REGULAR_TAB_WIDTH, REGULAR_TAB_WIDTH, SELECTOR_TAB_WIDTH] as const;

export const TABS_START = ICON_PADDING;
export const TAB_CENTER_XS = [
  ICON_PADDING + REGULAR_TAB_WIDTH * 0.5,
  ICON_PADDING + REGULAR_TAB_WIDTH * 1.5,
  ICON_PADDING + REGULAR_TAB_WIDTH * 2 + SELECTOR_TAB_WIDTH * 0.5,
] as const;

// --- Theme ---

export const COLORS = {
  background: "#0c0d0e",
  surface: "rgba(255, 255, 255, 0.06)",
  surfaceHover: "rgba(255, 255, 255, 0.12)",
  textPrimary: "rgba(255, 255, 255, 0.92)",
  textSecondary: "rgba(255, 255, 255, 0.45)",
  border: "rgba(255, 255, 255, 0.14)",
  glassGradientTop: "rgba(255, 255, 255, 0.12)",
  glassGradientBottom: "rgba(255, 255, 255, 0.04)",
  accentGreen: "#a8d480",
  iconDefault: "rgba(255, 255, 255, 0.7)",
  iconActive: "#a8d480",
} as const;

export const SPRING = {
  damping: 24,
  stiffness: 170,
  mass: 1,
} as const;

export const SPRING_BOUNCY = {
  damping: 20,
  stiffness: 220,
  mass: 0.65,
} as const;

// --- Liquid Glass Physics ---

const MAX_PULL = 60;
const MAX_STRETCH = 0.1;
const MAX_COMPRESS = 0.12;

export function liquidGlassTransform(
  pressed: number,
  overflowX: number,
  overflowY: number,
  halfW: number,
  halfH: number,
) {
  "worklet";

  const pressScale = interpolate(pressed, [0, 1], [1, 1.02]);

  const signX = overflowX < 0 ? -1 : 1;
  const dampedX = signX * MAX_PULL * (1 - 1 / (Math.abs(overflowX) / MAX_PULL + 1));
  const signY = overflowY < 0 ? -1 : 1;
  const dampedY = signY * MAX_PULL * (1 - 1 / (Math.abs(overflowY) / MAX_PULL + 1));

  const absDX = Math.abs(dampedX);
  const absDY = Math.abs(dampedY);

  const stretchX = interpolate(absDX, [0, MAX_PULL], [0, MAX_STRETCH], "clamp");
  const stretchY = interpolate(absDY, [0, MAX_PULL], [0, MAX_STRETCH], "clamp");

  const compressX = interpolate(absDY, [0, MAX_PULL], [0, MAX_COMPRESS], "clamp");
  const compressY = interpolate(absDX, [0, MAX_PULL], [0, MAX_COMPRESS], "clamp");

  return {
    transform: [
      { translateX: signX * halfW * stretchX },
      { translateY: signY * halfH * stretchY },
      { scaleX: pressScale * (1 + stretchX) * (1 - compressX) },
      { scaleY: pressScale * (1 + stretchY) * (1 - compressY) },
    ],
  };
}
