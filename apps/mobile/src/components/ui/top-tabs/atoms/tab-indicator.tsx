import Animated, { interpolate, type SharedValue, useAnimatedStyle } from "react-native-reanimated";

type Props = {
  activeTabIndex: SharedValue<number>;
  tabWidths: SharedValue<number[]>;
  tabOffsets: SharedValue<number[]>;
  tabBarOffsetX: SharedValue<number>;
  className?: string;
};

export function TabIndicator({
  activeTabIndex,
  tabWidths,
  tabOffsets,
  tabBarOffsetX,
  className = "absolute bottom-0 h-[2.5px] rounded-full bg-foreground",
}: Props) {
  const rIndicatorStyle = useAnimatedStyle(() => {
    const offsets = tabOffsets.value;
    const widths = tabWidths.value;
    const tabCount = Math.min(offsets.length, widths.length);

    if (tabCount === 0) {
      return { opacity: 0, width: 0 };
    }

    if (tabCount === 1) {
      return {
        left: offsets[0],
        width: widths[0],
        transform: [{ translateX: -tabBarOffsetX.value }],
      };
    }

    const inputRange = new Array<number>(tabCount);
    for (let index = 0; index < tabCount; index += 1) {
      inputRange[index] = index;
    }

    const left = interpolate(activeTabIndex.value, inputRange, offsets);
    const width = interpolate(activeTabIndex.value, inputRange, widths);

    return {
      left,
      width,
      transform: [{ translateX: -tabBarOffsetX.value }],
    };
  });

  return <Animated.View className={className} style={rIndicatorStyle} />;
}
