import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { useSegments } from "expo-router";
import type { PropsWithChildren } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { TabBarContent } from "./atoms/content";
import { ReaderTabBarContent } from "./atoms/reader-content";

type BlurSurfaceProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

function BlurSurface({ children, style }: BlurSurfaceProps) {
  return (
    <BlurView style={style} tint="systemThickMaterialDark">
      {children}
    </BlurView>
  );
}

export function TabBar(props: BottomTabBarProps) {
  const segments = useSegments();
  const isReaderRoute = segments.includes("[article]");
  const isAddRoute = segments.includes("add");

  if (isReaderRoute) {
    return <ReaderTabBarContent insets={props.insets} Surface={BlurSurface} />;
  }

  return <TabBarContent {...props} isAddRoute={isAddRoute} Surface={BlurSurface} />;
}
