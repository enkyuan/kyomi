import {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from "react-native-reanimated";

export const COMPACT_FADE_START = 24;
export const COMPACT_FADE_END = 46;

const EXPANDED_FADE_START = 0;
const EXPANDED_FADE_MID = 28;
const EXPANDED_FADE_END = 48;

/**
 * The header titles follow the scroll: the large title, inline on the left, fades out and
 * translates up; the compact one fades in at the centre as the scroll continues.
 */
export function useTitleScrollStyles(scrollY: SharedValue<number>) {
  const shouldReduceMotion = useReducedMotion();

  const largeTitleStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    const opacity = interpolate(
      y,
      [EXPANDED_FADE_START, EXPANDED_FADE_MID, EXPANDED_FADE_END],
      [1, 0.35, 0],
      Extrapolation.CLAMP,
    );

    if (shouldReduceMotion) {
      return { opacity };
    }

    return {
      opacity,
      transform: [
        {
          translateY: interpolate(
            y,
            [EXPANDED_FADE_START, EXPANDED_FADE_END],
            [0, -8],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            y,
            [EXPANDED_FADE_START, EXPANDED_FADE_END],
            [1, 0.96],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  const compactTitleStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    const opacity = interpolate(
      y,
      [COMPACT_FADE_START, COMPACT_FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );

    if (shouldReduceMotion) {
      return { opacity };
    }

    return {
      opacity,
      transform: [
        {
          translateY: interpolate(
            y,
            [COMPACT_FADE_START, COMPACT_FADE_END],
            [3, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  return { compactTitleStyle, largeTitleStyle };
}
