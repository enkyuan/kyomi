import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { useSegments } from "expo-router";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useLiquidGlassAvailable } from "@/components/ui/glass/use-liquid-glass";
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
  const isReaderRoute = useSegments().includes("[article]");

  if (isLiquidGlassAvailable) {
    return <LiquidTabBarContent {...props} isReaderRoute={isReaderRoute} />;
  }

  if (isReaderRoute) {
    return <ReaderTabBarContent Surface={BlurSurface} />;
  }

  return <TabBarContent {...props} Surface={BlurSurface} />;
}
