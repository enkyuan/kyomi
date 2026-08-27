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
export const COLLAPSE_DISTANCE = 28;
export const EXPAND_DISTANCE = 18;

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

export function useTabBarMinimizeScroll(scrollY: SharedValue<number>) {
  const { accumulatedDistance, direction, lastScrollY, minimizedSV } = useTabBarMinimize();

  return useAnimatedScrollHandler(
    {
      onScroll(event) {
        "worklet";
        const y = event.contentOffset.y;
        scrollY.set(y);

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
