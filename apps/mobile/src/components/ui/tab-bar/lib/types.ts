import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";
import type { ComponentType, PropsWithChildren } from "react";
import type { ColorValue, StyleProp, ViewStyle } from "react-native";

export type TabBarColors = {
  text: ColorValue;
};

export type TabBarSurface = ComponentType<
  PropsWithChildren<{
    style?: StyleProp<ViewStyle>;
  }>
>;

export type AnimatedTabProps = {
  isFocused: boolean;
  options: BottomTabNavigationOptions;
  colors: TabBarColors;
  accessibilityLabel: string;
  onPress: () => void;
  onLongPress: () => void;
  /** Some tabs (e.g. a toggle-style action) never tint their icon on focus. */
  showsActiveColor?: boolean;
  testID?: string;
};
