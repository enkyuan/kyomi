import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

export const MIN_SCROLL_Y = 24;
// Lower thresholds commit to a direction faster: Apple's own scroll-driven
// chrome (e.g. Safari's compact toolbar) reacts within the first few points
// of directional scroll rather than waiting for an accumulated run, so the
// collapse/expand reads as an immediate response to intent, not a delayed
// snap after a pause.
export const COLLAPSE_DISTANCE = 10;
export const EXPAND_DISTANCE = 6;

// This is intentionally a boolean boundary, not an animated progress value.
// SwiftUI owns the presentation animation after React receives a transition.
type MinimizeContextValue = {
  readonly minimized: boolean;
  readonly minimizedSV: SharedValue<boolean>;
  readonly lastScrollY: SharedValue<number>;
  readonly accumulatedDistance: SharedValue<number>;
  readonly direction: SharedValue<number>;
  readonly reset: () => void;
};

const MinimizeContext = createContext<MinimizeContextValue | null>(null);

export function TabBarMinimizeProvider({ children }: PropsWithChildren) {
  const [minimized, setMinimized] = useState(false);
  const minimizedSV = useSharedValue(false);
  const lastScrollY = useSharedValue(0);
  const accumulatedDistance = useSharedValue(0);
  const direction = useSharedValue(0);

  const publishMinimized = useCallback((next: boolean) => {
    setMinimized((current) => (current === next ? current : next));
  }, []);

  useAnimatedReaction(
    () => minimizedSV.get(),
    (next, previous) => {
      if (next !== previous) {
        scheduleOnRN(publishMinimized, next);
      }
    },
    [publishMinimized],
  );

  const reset = useCallback(() => {
    minimizedSV.set(false);
    lastScrollY.set(0);
    accumulatedDistance.set(0);
    direction.set(0);
    setMinimized(false);
  }, [accumulatedDistance, direction, lastScrollY, minimizedSV]);

  const value = useMemo<MinimizeContextValue>(
    () => ({
      accumulatedDistance,
      direction,
      lastScrollY,
      minimized,
      minimizedSV,
      reset,
    }),
    [accumulatedDistance, direction, lastScrollY, minimized, minimizedSV, reset],
  );

  return createElement(MinimizeContext, { value }, children);
}

export function useTabBarMinimize() {
  const context = useContext(MinimizeContext);
  if (!context) {
    throw new Error("useTabBarMinimize must be used within TabBarMinimizeProvider");
  }
  return context;
}

/**
 * Same as `useTabBarMinimize`, but returns `null` outside a
 * `TabBarMinimizeProvider` instead of throwing. Use this for screens that
 * are reused both inside the tab bar's tree and elsewhere (e.g. pushed into
 * a modal with no tab bar to minimize).
 */
export function useOptionalTabBarMinimize() {
  return useContext(MinimizeContext);
}

export function useTabBarMinimizeScroll(scrollY: SharedValue<number>) {
  // Optional: this scroll handler is shared by screens that may render
  // outside the tab bar's tree (e.g. Recents reused inside the settings
  // modal, which has no tab bar to minimize). In that case, skip the
  // minimize bookkeeping and only keep `scrollY` in sync for the header.
  const context = useOptionalTabBarMinimize();
  const accumulatedDistance = context?.accumulatedDistance;
  const direction = context?.direction;
  const lastScrollY = context?.lastScrollY;
  const minimizedSV = context?.minimizedSV;

  return useAnimatedScrollHandler(
    {
      onScroll(event) {
        "worklet";
        const y = event.contentOffset.y;
        scrollY.set(y);

        if (!accumulatedDistance || !direction || !lastScrollY || !minimizedSV) return;

        const delta = y - lastScrollY.get();
        lastScrollY.set(y);

        if (y <= MIN_SCROLL_Y) {
          accumulatedDistance.set(0);
          direction.set(0);
          if (minimizedSV.get()) minimizedSV.set(false);
          return;
        }

        const nextDirection = delta > 0 ? 1 : delta < 0 ? -1 : direction.get();
        if (nextDirection === 0) return;

        if (nextDirection !== direction.get()) {
          direction.set(nextDirection);
          accumulatedDistance.set(0);
        }

        accumulatedDistance.set(accumulatedDistance.get() + Math.abs(delta));

        if (nextDirection === 1 && accumulatedDistance.get() >= COLLAPSE_DISTANCE) {
          accumulatedDistance.set(0);
          if (!minimizedSV.get()) minimizedSV.set(true);
        } else if (nextDirection === -1 && accumulatedDistance.get() >= EXPAND_DISTANCE) {
          accumulatedDistance.set(0);
          if (minimizedSV.get()) minimizedSV.set(false);
        }
      },
    },
    [accumulatedDistance, direction, lastScrollY, minimizedSV, scrollY],
  );
}
