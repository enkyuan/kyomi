import type { PropsWithChildren } from "react";
import { Text, View, useColorScheme, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export const HEADER_CONTENT_HEIGHT = 48;

export type HeaderSurface = "default" | "transparent";

type HeaderProps = PropsWithChildren<{
  /**
   * The shared opaque app surface is the default. Use transparent only when
   * the parent owns a dynamic material, such as the Inbox scroll header.
   */
  surface?: HeaderSurface;
  title?: string;
  style?: StyleProp<ViewStyle>;
}>;

/**
 * Shared header geometry. Screens can supply a simple title or a richer
 * control such as the Inbox pager tabs, while all variants retain the same
 * safe-area and leading alignment.
 */
export function Header({ children, style, surface = "default", title }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const { background, foreground } = getMobileSurfaceTheme(useColorScheme());

  return (
    <View
      style={[
        { height: insets.top + HEADER_CONTENT_HEIGHT },
        surface === "default" ? { backgroundColor: background } : undefined,
        style,
      ]}
    >
      <View style={{ height: insets.top }} />
      {title ? (
        <View className="h-12 justify-center px-5 pb-1 pt-3" pointerEvents="none">
          <Text
            accessibilityRole="header"
            className="text-lg font-medium"
            numberOfLines={1}
            style={{ color: foreground }}
          >
            {title}
          </Text>
        </View>
      ) : (
        children
      )}
    </View>
  );
}
