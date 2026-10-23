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

/**
 * Direction bookkeeping for scroll offsets that arrive on the JS thread. The state is closed over
 * rather than held in a ref or a mutable object, so nothing React Compiler tracks is mutated.
 */
function createOffsetTracker() {
  let distance = 0;
  let direction = 0;
  let lastY = 0;
  let minimized = false;

  return {
    /** Records the published state, which another thread may have decided. */
    sync(next: boolean) {
      minimized = next;
    },
    reset() {
      distance = 0;
      direction = 0;
      lastY = 0;
      minimized = false;
    },
    track(y: number, setMinimized: (next: boolean) => void) {
      const delta = y - lastY;
      lastY = y;

      if (y <= MIN_SCROLL_Y) {
        distance = 0;
        direction = 0;
        if (minimized) setMinimized(false);
        return;
      }

      const nextDirection = delta > 0 ? 1 : delta < 0 ? -1 : direction;
      if (nextDirection === 0) return;

      if (nextDirection !== direction) {
        direction = nextDirection;
        distance = 0;
      }

      distance += Math.abs(delta);

      if (nextDirection === 1 && distance >= COLLAPSE_DISTANCE) {
        distance = 0;
        if (!minimized) setMinimized(true);
      } else if (nextDirection === -1 && distance >= EXPAND_DISTANCE) {
        distance = 0;
        if (minimized) setMinimized(false);
      }
    },
  };
}

// This is intentionally a boolean boundary, not an animated progress value.
// SwiftUI owns the presentation animation after React receives a transition.
//
// The controls never change identity, so scroll hooks (and the lists that call them) do not
// re-render when the bar minimizes. Only `TabBarWithMinimize` subscribes to the boolean.
type MinimizeControls = {
  readonly minimizedSV: SharedValue<boolean>;
  readonly lastScrollY: SharedValue<number>;
  readonly accumulatedDistance: SharedValue<number>;
  readonly direction: SharedValue<number>;
  /**
   * Feeds one scroll offset from the JS thread (native lists) through the direction rules. The
   * bookkeeping stays inside the provider's callbacks, so no ref is read while rendering.
   */
  readonly trackOffset: (y: number) => void;
  /** Publishes a transition decided on the JS thread. */
  readonly setMinimized: (next: boolean) => void;
  /** Publishes a transition decided by a worklet; runs on the JS thread. */
  readonly publishMinimized: (next: boolean) => void;
  readonly reset: () => void;
};

const MinimizeControlsContext = createContext<MinimizeControls | null>(null);
const MinimizedContext = createContext(false);

export function TabBarMinimizeProvider({ children }: PropsWithChildren) {
  const [minimized, setMinimizedState] = useState(false);
  const minimizedSV = useSharedValue(false);
  const lastScrollY = useSharedValue(0);
  const accumulatedDistance = useSharedValue(0);
  const direction = useSharedValue(0);
  const [tracker] = useState(createOffsetTracker);

  const publishMinimized = useCallback(
    (next: boolean) => {
      tracker.sync(next);
      setMinimizedState(next);
    },
    [tracker],
  );

  // A transition is published from exactly one thread, straight to React. Echoing the shared
  // value back through an animated reaction would deliver a stale value after a quick reversal
  // and flap the bar.
  const setMinimized = useCallback(
    (next: boolean) => {
      publishMinimized(next);
      minimizedSV.set(next);
    },
    [minimizedSV, publishMinimized],
  );

  const trackOffset = useCallback(
    (y: number) => tracker.track(y, setMinimized),
    [setMinimized, tracker],
  );

  const reset = useCallback(() => {
    tracker.reset();
    minimizedSV.set(false);
    lastScrollY.set(0);
    accumulatedDistance.set(0);
    direction.set(0);
    setMinimizedState(false);
  }, [accumulatedDistance, direction, lastScrollY, minimizedSV, tracker]);

  const controls = useMemo<MinimizeControls>(
    () => ({
      accumulatedDistance,
      direction,
      lastScrollY,
      minimizedSV,
      publishMinimized,
      reset,
      setMinimized,
      trackOffset,
    }),
    [
      accumulatedDistance,
      direction,
      lastScrollY,
      minimizedSV,
      publishMinimized,
      reset,
      setMinimized,
      trackOffset,
    ],
  );

  return createElement(
    MinimizeControlsContext,
    { value: controls },
    createElement(MinimizedContext, { value: minimized }, children),
  );
}

/** Whether the bar is minimized. Subscribes to every transition, so use it only where it renders. */
export function useTabBarMinimized() {
  return useContext(MinimizedContext);
}

/**
 * Returns `null` outside a `TabBarMinimizeProvider`. Screens are reused both inside the tab bar's
 * tree and elsewhere (e.g. pushed into a modal with no tab bar to minimize).
 */
export function useOptionalTabBarMinimize() {
  return useContext(MinimizeControlsContext);
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
  const publishMinimized = context?.publishMinimized;

  return useAnimatedScrollHandler(
    {
      onScroll(event) {
        "worklet";
        const y = event.contentOffset.y;
        scrollY.set(y);

        if (
          !accumulatedDistance ||
          !direction ||
          !lastScrollY ||
          !minimizedSV ||
          !publishMinimized
        ) {
          return;
        }

        const setMinimized = (next: boolean) => {
          if (minimizedSV.get() === next) return;
          minimizedSV.set(next);
          scheduleOnRN(publishMinimized, next);
        };

        const delta = y - lastScrollY.get();
        lastScrollY.set(y);

        if (y <= MIN_SCROLL_Y) {
          accumulatedDistance.set(0);
          direction.set(0);
          setMinimized(false);
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
          setMinimized(true);
        } else if (nextDirection === -1 && accumulatedDistance.get() >= EXPAND_DISTANCE) {
          accumulatedDistance.set(0);
          setMinimized(false);
        }
      },
    },
    [accumulatedDistance, direction, lastScrollY, minimizedSV, publishMinimized, scrollY],
  );
}

/**
 * Scroll offsets reported by a native list (`onScroll` of `ArticleListView`) feed the same
 * direction rules as `useTabBarMinimizeScroll`, which runs as a worklet on Reanimated scroll events.
 * These events arrive on the JS thread, so the bookkeeping lives in a ref the provider owns (and
 * resets) behind `trackOffset`: reading a shared value written since the last read blocks JS on a synchronous round-trip
 * to the UI thread, and this runs on every scroll event. A transition goes straight to React; it
 * does not detour through the UI thread and back before the bar can start moving.
 */
export function useTabBarMinimizeOffset(scrollY: SharedValue<number>) {
  const trackOffset = useOptionalTabBarMinimize()?.trackOffset;

  return useCallback(
    (y: number) => {
      scrollY.set(y);
      trackOffset?.(y);
    },
    [scrollY, trackOffset],
  );
}
