import { useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { cancelAnimation, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { PILL_HEIGHT, PILL_WIDTH, SPRING_BOUNCY } from "../lib/constants";

/** Handles the liquid-glass pull without changing the selected tab while dragging. */
export function usePill() {
  const pillPressed = useSharedValue(0);
  const overflowX = useSharedValue(0);
  const overflowY = useSharedValue(0);
  const touchX = useSharedValue(PILL_WIDTH / 2);
  const touchY = useSharedValue(PILL_HEIGHT / 2);
  const glowProgress = useSharedValue(0);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(10)
        .onStart((event) => {
          cancelAnimation(overflowX);
          cancelAnimation(overflowY);
          cancelAnimation(glowProgress);

          touchX.set(event.x);
          touchY.set(event.y);
          pillPressed.set(withTiming(1, { duration: 80 }));
          glowProgress.set(1);
        })
        .onUpdate((event) => {
          touchX.set(event.x);
          touchY.set(event.y);

          overflowX.set(event.x < 0 ? event.x : event.x > PILL_WIDTH ? event.x - PILL_WIDTH : 0);
          overflowY.set(event.y < 0 ? event.y : event.y > PILL_HEIGHT ? event.y - PILL_HEIGHT : 0);
        })
        .onEnd(() => {
          pillPressed.set(withTiming(0, { duration: 150 }));
          glowProgress.set(withTiming(2, { duration: 300 }));
          overflowX.set(withSpring(0, SPRING_BOUNCY));
          overflowY.set(withSpring(0, SPRING_BOUNCY));
        }),
    [glowProgress, overflowX, overflowY, pillPressed, touchX, touchY],
  );

  return {
    glowProgress,
    overflowX,
    overflowY,
    panGesture,
    pillPressed,
    touchX,
    touchY,
  };
}
