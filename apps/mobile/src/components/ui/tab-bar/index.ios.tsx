import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { useSegments } from "expo-router";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useLiquidGlassAvailable } from "@ui/liquid-glass/use-availability";
import { TabBarContent } from "./atoms/content";
import { LiquidTabBarContent } from "./atoms/liquid-content.ios";
import { ReaderTabBarContent } from "./atoms/reader-content";

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

export function TabBar(props: BottomTabBarProps) {
  // Older iOS versions and reduced-transparency users retain the established
  // blurred material rather than attempting an unavailable glass effect.
  const isLiquidGlassAvailable = useLiquidGlassAvailable();
  const segments = useSegments();
  const isReaderRoute = segments.includes("[article]");
  const isAddRoute = segments.includes("add");

  if (isLiquidGlassAvailable) {
    return <LiquidTabBarContent {...props} isAddRoute={isAddRoute} isReaderRoute={isReaderRoute} />;
  }

  if (isReaderRoute) {
    return <ReaderTabBarContent insets={props.insets} Surface={BlurSurface} />;
  }

  return <TabBarContent {...props} isAddRoute={isAddRoute} Surface={BlurSurface} />;
}
