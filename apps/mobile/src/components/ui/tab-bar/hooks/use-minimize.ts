import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { NativeSyntheticEvent } from "react-native";
import {
  useAnimatedScrollHandler,
  useEvent,
  useHandler,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

export const MIN_SCROLL_Y = 24;
// Lower thresholds commit to a direction faster: Apple's own scroll-driven
// chrome (e.g. Safari's compact toolbar) reacts within the first few points
// of directional scroll rather than waiting for an accumulated run, so the
// collapse/expand reads as an immediate response to intent, not a delayed
// snap after a pause.
export const COLLAPSE_DISTANCE = 10;
export const EXPAND_DISTANCE = 6;

/**
 * Offsets past the end of the content are rubber-banding: the bounce reverses direction without
 * the user asking for the bar, so they count as resting at the end.
 */
function clampOverscroll(y: number, maxY: number) {
  "worklet";
  return Math.min(y, Math.max(maxY, 0));
}

// This is intentionally a boolean boundary, not an animated progress value.
// SwiftUI owns the presentation animation once the bar's `minimized` prop flips.
//
// Every list feeds its offsets to a worklet on the UI thread, and the bar reads `minimizedSV`
// through animated props, so a transition reaches the native bar without touching the JS thread:
// a busy JS thread (paging, rendering) can no longer delay the bar. Nothing re-renders on a
// transition, and the controls never change identity.
type MinimizeControls = {
  readonly minimizedSV: SharedValue<boolean>;
  readonly lastScrollY: SharedValue<number>;
  readonly accumulatedDistance: SharedValue<number>;
  readonly direction: SharedValue<number>;
  readonly reset: () => void;
};

const MinimizeControlsContext = createContext<MinimizeControls | null>(null);

export function TabBarMinimizeProvider({ children }: PropsWithChildren) {
  const minimizedSV = useSharedValue(false);
  const lastScrollY = useSharedValue(0);
  const accumulatedDistance = useSharedValue(0);
  const direction = useSharedValue(0);

  const reset = useCallback(() => {
    minimizedSV.set(false);
    lastScrollY.set(0);
    accumulatedDistance.set(0);
    direction.set(0);
  }, [accumulatedDistance, direction, lastScrollY, minimizedSV]);

  const controls = useMemo<MinimizeControls>(
    () => ({
      accumulatedDistance,
      direction,
      lastScrollY,
      minimizedSV,
      reset,
    }),
    [accumulatedDistance, direction, lastScrollY, minimizedSV, reset],
  );

  return createElement(MinimizeControlsContext, { value: controls }, children);
}

/**
 * Returns `null` outside a `TabBarMinimizeProvider`. Screens are reused both inside the tab bar's
 * tree and elsewhere (e.g. pushed into a modal with no tab bar to minimize).
 */
export function useOptionalTabBarMinimize() {
  return useContext(MinimizeControlsContext);
}

/**
 * The direction rules as a worklet: `y` is the scroll offset with overscroll already clamped.
 * Optional: scroll handlers are shared by screens that may render outside the tab bar's tree (e.g.
 * Recents reused inside the settings modal, which has no tab bar to minimize). There the worklet
 * does nothing and the caller only keeps `scrollY` in sync for the header.
 */
function useMinimizeTracker() {
  const context = useOptionalTabBarMinimize();
  const accumulatedDistance = context?.accumulatedDistance;
  const direction = context?.direction;
  const lastScrollY = context?.lastScrollY;
  const minimizedSV = context?.minimizedSV;

  return useCallback(
    (y: number) => {
      "worklet";
      if (!accumulatedDistance || !direction || !lastScrollY || !minimizedSV) return;

      const setMinimized = (next: boolean) => {
        if (minimizedSV.get() !== next) minimizedSV.set(next);
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
    [accumulatedDistance, direction, lastScrollY, minimizedSV],
  );
}

export function useTabBarMinimizeScroll(scrollY: SharedValue<number>) {
  const track = useMinimizeTracker();

  return useAnimatedScrollHandler(
    {
      onScroll(event) {
        "worklet";
        scrollY.set(event.contentOffset.y);
        track(
          clampOverscroll(
            event.contentOffset.y,
            event.contentSize.height + event.contentInset.bottom - event.layoutMeasurement.height,
          ),
        );
      },
    },
    [scrollY, track],
  );
}

type NativeListScrollEvent = { y: number; maxY: number };

type NativeListScrollOptions = {
  /** Added to every offset, e.g. a top content inset the list rests beneath. */
  readonly offset?: number;
  /** Runs on the UI thread with each offset after `offset` is applied. */
  readonly onScroll?: (y: number) => void;
};

/**
 * `onScroll` for `ArticleListView` (wrapped with `Animated.createAnimatedComponent`). Reanimated
 * receives the native view's scroll event on the UI thread, as it does a `ScrollView`'s, so the
 * header tracks every frame and the direction rules decide there; no offset crosses to JS.
 */
export function useTabBarMinimizeNativeScroll(
  scrollY: SharedValue<number>,
  { offset = 0, onScroll: onOffset }: NativeListScrollOptions = {},
) {
  const track = useMinimizeTracker();
  // Neither the handler nor the captured callback may be named `onScroll`: the Worklets Babel
  // plugin declares a worklet method under its own name, which then collides with a captured
  // binding of the same name ("Duplicate declaration") and fails the bundle.
  const handlers = useMemo(
    () => ({
      handleScroll: (event: NativeListScrollEvent) => {
        "worklet";
        const y = event.y + offset;
        scrollY.set(y);
        onOffset?.(y);
        track(clampOverscroll(y, event.maxY + offset));
      },
    }),
    [offset, onOffset, scrollY, track],
  );
  const { doDependenciesDiffer } = useHandler(handlers, [offset, onOffset, scrollY, track]);

  // Reanimated hands the worklet the event's payload; the type names the event JS would see.
  return useEvent<NativeSyntheticEvent<NativeListScrollEvent>>(
    (event) => {
      "worklet";
      handlers.handleScroll(event);
    },
    ["onScroll"],
    doDependenciesDiffer,
  );
}
