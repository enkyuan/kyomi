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
const TITLE_MATERIALIZE_MS = 350;

/** How far, in points, a title slides as it arrives and leaves, in the direction of travel. */
const TITLE_SLIDE = 24;

/** Blur, in points, a title carries while it is not there yet or no longer is. */
const TITLE_MATERIALIZE_BLUR = 10;

/** UIKit's navigation transition curve: quick off the mark, long settle. */
const TITLE_EASING = Easing.bezier(0.2, 0, 0, 1);

/**
 * The header each group last showed. Sibling screens (tabs) swap instantly, so the screen taking
 * over fades the previous title out itself, from where its scroll left it.
 */
const lastShown = new Map<string, { order: number; scrollY: SharedValue<number>; title: string }>();

type TitleTransform = readonly (
  | { scale: number }
  | { translateX: number }
  | { translateY: number }
)[];

function largeTitleAt(
  y: number,
  reduceMotion: boolean,
): { opacity: number; transform?: TitleTransform } {
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

function compactTitleAt(
  y: number,
  reduceMotion: boolean,
): { opacity: number; transform?: TitleTransform } {
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
  /** Position among the group's headers, which sets the direction a handover slides. */
  order: number;
  scrollY: SharedValue<number>;
  title: string;
};

/**
 * A title that is `presence` (0 to 1) of the way in, over its scroll style: faded, blurred and
 * `offsetX` points to the side while it is not.
 */
function materialized(
  style: { opacity: number; transform?: TitleTransform },
  presence: number,
  offsetX: number,
) {
  "worklet";
  return {
    filter: presence < 1 ? [{ blur: (1 - presence) * TITLE_MATERIALIZE_BLUR }] : [],
    opacity: style.opacity * presence,
    transform: [{ translateX: offsetX }, ...(style.transform ?? [])],
  };
}

/**
 * Animated styles for the header's large and compact titles, which follow the scroll. When a
 * sibling header in the same group hands over, the previous title (kept as a ghost at the scroll
 * position it was left at) blurs, fades and slides out the way things travel while this one's
 * materializes from the other side, as a navigation bar's titles do between screens.
 */
export function useTitleStyles({ group, order, scrollY, title }: TitleStylesArgs) {
  const shouldReduceMotion = useReducedMotion();
  const focused = useIsFocused();
  // 0 as the previous title still shows, 1 once this one has taken over.
  const handover = useSharedValue(1);
  // +1 when this header follows its predecessor in the group (forward), -1 when it precedes it.
  const direction = useSharedValue(1);
  const ghostY = useSharedValue(0);
  const [ghostTitle, setGhostTitle] = useState<string | null>(null);

  // Before paint, so the first frame already has the ghost and not an empty header.
  useLayoutEffect(() => {
    if (!group || !focused) return;
    const previous = lastShown.get(group);
    lastShown.set(group, { order, scrollY, title });
    if (!previous || previous.title === title) return;

    ghostY.set(previous.scrollY.get());
    direction.set(order >= previous.order ? 1 : -1);
    setGhostTitle(previous.title);
    handover.set(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: TITLE_MATERIALIZE_MS, easing: TITLE_EASING }, (finished) => {
          if (finished) scheduleOnRN(setGhostTitle, null);
        }),
      ),
    );
  }, [direction, focused, ghostY, group, handover, order, scrollY, title]);

  // The previous title is gone by 60% of the way; this one starts arriving a fifth in.
  const arriving = () => {
    "worklet";
    const presence = Math.min(1, Math.max(0, (handover.value - 0.2) / 0.8));
    return {
      offsetX: shouldReduceMotion ? 0 : direction.value * TITLE_SLIDE * (1 - presence),
      presence,
    };
  };
  const leaving = () => {
    "worklet";
    const presence = 1 - Math.min(1, handover.value / 0.6);
    return {
      offsetX: shouldReduceMotion ? 0 : -direction.value * TITLE_SLIDE * (1 - presence),
      presence,
    };
  };

  // Large title: inline on the left, fades out and translates up on scroll.
  const largeTitleStyle = useAnimatedStyle(() => {
    const { offsetX, presence } = arriving();
    return materialized(
      largeTitleAt(Math.max(0, scrollY.value), shouldReduceMotion),
      presence,
      offsetX,
    );
  });

  // Centered compact title: fades in at center as scroll continues.
  const compactTitleStyle = useAnimatedStyle(() => {
    const { offsetX, presence } = arriving();
    return materialized(
      compactTitleAt(Math.max(0, scrollY.value), shouldReduceMotion),
      presence,
      offsetX,
    );
  });

  const ghostLargeStyle = useAnimatedStyle(() => {
    const { offsetX, presence } = leaving();
    return materialized(
      largeTitleAt(Math.max(0, ghostY.value), shouldReduceMotion),
      presence,
      offsetX,
    );
  });

  const ghostCompactStyle = useAnimatedStyle(() => {
    const { offsetX, presence } = leaving();
    return materialized(
      compactTitleAt(Math.max(0, ghostY.value), shouldReduceMotion),
      presence,
      offsetX,
    );
  });

  return { compactTitleStyle, ghostCompactStyle, ghostLargeStyle, ghostTitle, largeTitleStyle };
}
