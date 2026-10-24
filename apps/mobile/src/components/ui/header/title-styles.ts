import { useIsFocused } from "expo-router";
import { useLayoutEffect, useState } from "react";
import {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const COMPACT_FADE_START = 24;
const COMPACT_FADE_END = 46;

const EXPANDED_FADE_START = 0;
const EXPANDED_FADE_MID = 28;
const EXPANDED_FADE_END = 48;

/** How long a title takes to materialize in and out, close to a navigation bar's own. */
const TITLE_MATERIALIZE_MS = 320;

/** Blur, in points, a title carries while it is not there yet or no longer is. */
const TITLE_MATERIALIZE_BLUR = 10;

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

/** Opacity and blur of a title that is `presence` (0 to 1) of the way in, over its scroll style. */
function materialized<T extends { opacity: number }>(style: T, presence: number) {
  "worklet";
  return {
    ...style,
    filter: presence < 1 ? [{ blur: (1 - presence) * TITLE_MATERIALIZE_BLUR }] : [],
    opacity: style.opacity * presence,
  };
}

/**
 * Animated styles for the header's large and compact titles, which follow the scroll. When a
 * sibling header in the same group hands over, this one's title materializes (fades in out of a
 * blur) while the previous title, kept as a ghost at the scroll position it was left at, blurs
 * and fades out, as a navigation bar's titles do between screens.
 */
export function useTitleStyles({ group, scrollY, title }: TitleStylesArgs) {
  const shouldReduceMotion = useReducedMotion();
  const focused = useIsFocused();
  // 0 as the previous title still shows, 1 once this one has taken over.
  const handover = useSharedValue(1);
  const ghostY = useSharedValue(0);
  const [ghostTitle, setGhostTitle] = useState<string | null>(null);

  // Before paint, so the first frame already has the ghost and not an empty header.
  useLayoutEffect(() => {
    if (!group || !focused) return;
    const previous = lastShown.get(group);
    lastShown.set(group, { scrollY, title });
    if (!previous || previous.title === title) return;

    ghostY.set(previous.scrollY.get());
    setGhostTitle(previous.title);
    handover.set(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(
          1,
          { duration: TITLE_MATERIALIZE_MS, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(setGhostTitle, null);
          },
        ),
      ),
    );
  }, [focused, ghostY, group, handover, scrollY, title]);

  // Large title: inline on the left, fades out and translates up on scroll.
  const largeTitleStyle = useAnimatedStyle(() =>
    materialized(largeTitleAt(Math.max(0, scrollY.value), shouldReduceMotion), handover.value),
  );

  // Centered compact title: fades in at center as scroll continues.
  const compactTitleStyle = useAnimatedStyle(() =>
    materialized(compactTitleAt(Math.max(0, scrollY.value), shouldReduceMotion), handover.value),
  );

  const ghostLargeStyle = useAnimatedStyle(() =>
    materialized(largeTitleAt(Math.max(0, ghostY.value), shouldReduceMotion), 1 - handover.value),
  );

  const ghostCompactStyle = useAnimatedStyle(() =>
    materialized(compactTitleAt(Math.max(0, ghostY.value), shouldReduceMotion), 1 - handover.value),
  );

  return { compactTitleStyle, ghostCompactStyle, ghostLargeStyle, ghostTitle, largeTitleStyle };
}
