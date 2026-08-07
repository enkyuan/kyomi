import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { useSegments } from "expo-router";
import { useEffect, type PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useLiquidGlassAvailable } from "@ui/liquid-glass/use-availability";
import { TabBarContent } from "./atoms/content";
import { LiquidTabBarContent } from "./atoms/liquid-content.ios";
import { ReaderTabBarContent } from "./atoms/reader-content";
import { getFloatingBarPosition, type FloatingBarPosition } from "./lib/styles";
import { useScreenCorners } from "./hooks/use-screen";

type TabBarProps = BottomTabBarProps & {
  /** Reports the physical tab-bar placement to overlays anchored to its actions. */
  readonly onFloatingBarPositionChange?: (position: FloatingBarPosition) => void;
};

type SurfaceProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

function BlurSurface({ children, style }: SurfaceProps) {
  return (
    <BlurView style={style} tint="systemThickMaterialDark">
      {children}
    </BlurView>
  );
}

export function TabBar({ onFloatingBarPositionChange, ...props }: TabBarProps) {
  const screenCorners = useScreenCorners();
  // Older iOS versions and reduced-transparency users retain the established
  // blurred material rather than attempting an unavailable glass effect.
  const isLiquidGlassAvailable = useLiquidGlassAvailable();
  const segments = useSegments();
  const isReaderRoute = segments.includes("[article]");
  const isAddRoute = segments.includes("add");
  useEffect(() => {
    onFloatingBarPositionChange?.(getFloatingBarPosition(props.insets, screenCorners));
  }, [
    onFloatingBarPositionChange,
    props.insets.bottom,
    props.insets.left,
    props.insets.right,
    screenCorners,
  ]);

  if (isLiquidGlassAvailable) {
    return (
      <LiquidTabBarContent
        {...props}
        isAddRoute={isAddRoute}
        isReaderRoute={isReaderRoute}
        screenCorners={screenCorners}
      />
    );
  }

  if (isReaderRoute) {
    return (
      <ReaderTabBarContent
        insets={props.insets}
        screenCorners={screenCorners}
        Surface={BlurSurface}
      />
    );
  }

  return (
    <TabBarContent
      {...props}
      isAddRoute={isAddRoute}
      screenCorners={screenCorners}
      Surface={BlurSurface}
    />
  );
}
