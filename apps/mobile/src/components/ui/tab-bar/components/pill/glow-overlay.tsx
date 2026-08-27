import Animated, { interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

interface GlowOverlayProps {
  readonly glowProgress: SharedValue<number>;
  readonly id: string;
  readonly size: number;
  readonly touchX: SharedValue<number>;
  readonly touchY: SharedValue<number>;
}

export function GlowOverlay({ glowProgress, id, size, touchX, touchY }: GlowOverlayProps) {
  const half = size / 2;

  const glowStyle = useAnimatedStyle(() => {
    const progress = glowProgress.get();
    const opacity =
      progress <= 1 ? progress * 0.2 : interpolate(progress, [1, 2], [0.2, 0], "clamp");
    const scale = progress <= 1 ? 1 : interpolate(progress, [1, 2], [1, 4], "clamp");

    return {
      opacity,
      transform: [
        { translateX: touchX.get() - half },
        { translateY: touchY.get() - half },
        { scale },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ height: size, left: 0, position: "absolute", top: 0, width: size }, glowStyle]}
    >
      <Svg height={size} width={size}>
        <Defs>
          <RadialGradient cx="50%" cy="50%" id={id} r="50%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect fill={`url(#${id})`} height={size} width={size} />
      </Svg>
    </Animated.View>
  );
}
