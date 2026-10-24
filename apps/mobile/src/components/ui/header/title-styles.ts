import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const COMPACT_FADE_START = 24;
const COMPACT_FADE_END = 46;

const EXPANDED_FADE_START = 0;
const EXPANDED_FADE_MID = 28;
const EXPANDED_FADE_END = 48;

/** How long a title takes to cross-fade into its sibling's, close to a navigation bar's own. */
const TITLE_CROSSFADE_MS = 240;

/**
 * The header each group last showed. Sibling screens (tabs) swap instantly, so the screen taking
 * over fades the previous title out itself, from where its scroll left it.
 */
const lastShown = new Map<string, { scrollY: SharedValue<number>; title: string }>();

function largeTitleAt(y: number, reduceMotion: boolean) {
  "worklet";
  const opacity = interpolate(
    y,
    [EXPANDED_FADE_START, EXPANDED_FADE_MID, EXPANDED_FADE_END],
    [1, 0.35, 0],
    Extrapolation.CLAMP,
  );
  if (reduceMotion) return { opacity };

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
}

function compactTitleAt(y: number, reduceMotion: boolean) {
  "worklet";
  const opacity = interpolate(
    y,
    [COMPACT_FADE_START, COMPACT_FADE_END],
    [0, 1],
    Extrapolation.CLAMP,
  );
  if (reduceMotion) return { opacity };

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
}

type TitleStylesArgs = {
  group?: string;
  scrollY: SharedValue<number>;
  title: string;
};

/**
 * Animated styles for the header's large and compact titles, which follow the scroll. When a
 * sibling header in the same group hands over, this one fades in while the previous title, kept
 * as a ghost at the scroll position it was left at, fades out.
 */
export function useTitleStyles({ group, scrollY, title }: TitleStylesArgs) {
  const shouldReduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const enter = useSharedValue(1);
  const ghostOpacity = useSharedValue(0);
  const ghostY = useSharedValue(0);
  const [ghostTitle, setGhostTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!group || !focused) return;
    const previous = lastShown.get(group);
    lastShown.set(group, { scrollY, title });
    if (!previous || previous.title === title) return;

    ghostY.set(previous.scrollY.get());
    setGhostTitle(previous.title);
    enter.set(0);
    ghostOpacity.set(1);
    const timing = { duration: TITLE_CROSSFADE_MS, easing: Easing.out(Easing.cubic) };
    enter.set(withTiming(1, timing));
    ghostOpacity.set(
      withTiming(0, timing, (finished) => {
        if (finished) scheduleOnRN(setGhostTitle, null);
      }),
    );
  }, [enter, focused, ghostOpacity, ghostY, group, scrollY, title]);

  // Large title: inline on the left, fades out and translates up on scroll.
  const largeTitleStyle = useAnimatedStyle(() => {
    const style = largeTitleAt(Math.max(0, scrollY.value), shouldReduceMotion);
    return { ...style, opacity: style.opacity * enter.value };
  });

  // Centered compact title: fades in at center as scroll continues.
  const compactTitleStyle = useAnimatedStyle(() => {
    const style = compactTitleAt(Math.max(0, scrollY.value), shouldReduceMotion);
    return { ...style, opacity: style.opacity * enter.value };
  });

  const ghostLargeStyle = useAnimatedStyle(() => {
    const style = largeTitleAt(Math.max(0, ghostY.value), shouldReduceMotion);
    return { ...style, opacity: style.opacity * ghostOpacity.value };
  });

  const ghostCompactStyle = useAnimatedStyle(() => {
    const style = compactTitleAt(Math.max(0, ghostY.value), shouldReduceMotion);
    return { ...style, opacity: style.opacity * ghostOpacity.value };
  });

  return { compactTitleStyle, ghostCompactStyle, ghostLargeStyle, ghostTitle, largeTitleStyle };
}
