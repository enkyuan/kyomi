import type { PropsWithChildren } from "react";
import { Text, View, useColorScheme, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMobileSurfaceTheme } from "@/theme/surfaces";

export const HEADER_CONTENT_HEIGHT = 48;

// The title variant needs a taller strip than the tab-bar variant to seat a
// large title; only that variant opts into the extra height, so the inbox's
// tab-bar blur edge stays put.
export const TITLE_CONTENT_HEIGHT = 60;

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

  const contentHeight = title ? TITLE_CONTENT_HEIGHT : HEADER_CONTENT_HEIGHT;

  return (
    <View
      style={[
        { height: insets.top + contentHeight },
        surface === "default" ? { backgroundColor: background } : undefined,
        style,
      ]}
    >
      <View style={{ height: insets.top }} />
      {title ? (
        <View
          className="justify-center px-5 pb-1"
          pointerEvents="none"
          style={{ height: TITLE_CONTENT_HEIGHT }}
        >
          <Text
            accessibilityRole="header"
            allowFontScaling={false}
            className="text-[28px] font-bold"
            numberOfLines={1}
            // Negative tracking keeps a large title from reading loose — Apple
            // tightens tracking as type grows; a fixed 0 would look airy here.
            style={{ color: foreground, letterSpacing: -0.4, lineHeight: 34 }}
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

export {
  CollapsingHeader,
  HeaderActionButton,
  COLLAPSE_DISTANCE,
  COMPACT_NAV_HEIGHT,
  EXPANDED_TITLE_HEIGHT,
  type CollapsingHeaderProps,
  type HeaderActionButtonProps,
} from "./collapsing";
