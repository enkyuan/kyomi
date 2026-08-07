import type { PropsWithChildren } from "react";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const SPRING_CONFIG = { damping: 120, stiffness: 1000 };

type AnimatedActionMenuRowProps = PropsWithChildren<{
  readonly alignment: "start" | "end";
  readonly containerHeight: SharedValue<number>;
  readonly index: number;
  readonly isOpen: SharedValue<boolean>;
  readonly numberOfRows: number;
  readonly shouldReduceMotion: boolean;
}>;

/** A row collapses back toward the trigger, then springs into its own position. */
export function AnimatedActionMenuRow({
  alignment,
  containerHeight,
  children,
  index,
  isOpen,
  numberOfRows,
  shouldReduceMotion,
}: AnimatedActionMenuRowProps) {
  const rowStyle = useAnimatedStyle(() => {
    const closedOffset = containerHeight.value - index * (containerHeight.value / numberOfRows);
    const closedX = alignment === "end" ? 20 : -20;
    const targetOpacity = isOpen.value ? 1 : 0;
    const targetX = isOpen.value ? 0 : closedX;
    const targetY = isOpen.value ? 0 : closedOffset;

    return {
      opacity: shouldReduceMotion ? targetOpacity : withTiming(targetOpacity, { duration: 160 }),
      transform: [
        { translateX: shouldReduceMotion ? targetX : withSpring(targetX, SPRING_CONFIG) },
        { translateY: shouldReduceMotion ? targetY : withSpring(targetY, SPRING_CONFIG) },
      ],
    };
  });

  return <Animated.View style={rowStyle}>{children}</Animated.View>;
}
