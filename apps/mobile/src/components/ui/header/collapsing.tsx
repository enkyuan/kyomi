import type { PropsWithChildren, ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { GlassContainer, GlassView } from "expo-glass-effect";
import { ProgressiveBlur, CHROME_BLUR_BLEED } from "@ui/liquid-glass/progressive-blur";
import { useTheme } from "@ui/liquid-glass/hooks/use-theme";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { useTitleScrollStyles } from "./title-scroll";

export const COMPACT_NAV_HEIGHT = 48;
export const COLLAPSE_DISTANCE = 52;
export const EXPANDED_TITLE_HEIGHT = 44;

/** Scroll offset over which the blur behind the header fades in, so it reads as content slides under. */
const BLUR_FADE_END = 16;

// ============================================================================
// Header Action Button (Native Liquid Glass Pill)
// ============================================================================

export type HeaderActionButtonProps = {
  icon: ReactNode;
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function HeaderActionButton({
  disabled = false,
  icon,
  label,
  onPress,
  style,
}: HeaderActionButtonProps) {
  const isDark = useColorScheme() === "dark";

  const buttonContent = (
    <>
      <GlassView
        colorScheme={isDark ? "dark" : "light"}
        glassEffectStyle="regular"
        isInteractive
        pointerEvents="none"
        style={styles.glassButtonSurface}
      />
      <View style={styles.actionIconWrapper}>{icon}</View>
    </>
  );

  if (!onPress) {
    return (
      <View
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        pointerEvents="none"
        style={[styles.actionButton, { opacity: disabled ? 0.4 : 1 }, style]}
      >
        {buttonContent}
      </View>
    );
  }

  const handlePress = () => {
    if (disabled) return;
    if (Platform.OS === "ios") {
      void Haptics.selectionAsync();
    }
    onPress();
  };

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.actionButton,
        {
          opacity: pressed ? 0.72 : disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {buttonContent}
    </Pressable>
  );
}

// ============================================================================
// Collapsing Header (Fixed Top Navigation Chrome with Inline Title & Actions)
// ============================================================================

export type CollapsingHeaderProps = PropsWithChildren<{
  /** Omitted when a shared title (`SharedHeaderTitle`) draws it above the screens. */
  title?: string;
  scrollY: SharedValue<number>;
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export function CollapsingHeader({
  actions,
  children,
  scrollY,
  style,
  title,
}: CollapsingHeaderProps) {
  const insets = useSafeAreaInsets();
  const { foreground } = getMobileSurfaceTheme(useColorScheme());
  const { scheme } = useTheme();

  const totalHeaderHeight = insets.top + COMPACT_NAV_HEIGHT;

  // Progressive blur behind the chrome once content scrolls under it, for title and action contrast.
  const blurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.max(0, scrollY.value),
      [0, BLUR_FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const { compactTitleStyle, largeTitleStyle } = useTitleScrollStyles(scrollY);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.fixedHeaderRoot,
        {
          height: totalHeaderHeight,
          paddingTop: insets.top,
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            height: totalHeaderHeight + CHROME_BLUR_BLEED,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          },
          blurStyle,
        ]}
      >
        <ProgressiveBlur direction="top" style={{ flex: 1 }} tint={scheme} />
      </Animated.View>

      {title ? (
        <>
          {/* Large Title (Inline on the Left, Vertically Centered with Actions) */}
          <Animated.View
            accessibilityRole="header"
            pointerEvents="none"
            style={[
              styles.largeTitleContainer,
              {
                bottom: 0,
                height: COMPACT_NAV_HEIGHT,
              },
              largeTitleStyle,
            ]}
          >
            <Text
              accessibilityLabel={title}
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.expandedTitleText, FONT_STYLES.largeTitle, { color: foreground }]}
            >
              {title}
            </Text>
          </Animated.View>

          {/* Absolutely Centered Compact Title (Fades In on Scroll) */}
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[
              styles.compactTitleContainer,
              {
                bottom: 0,
                height: COMPACT_NAV_HEIGHT,
              },
              compactTitleStyle,
            ]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.compactTitleText, FONT_STYLES.compactTitle, { color: foreground }]}
            >
              {title}
            </Text>
          </Animated.View>
        </>
      ) : null}

      {/* Trailing Action Controls (Inline on the Right with GlassContainer) */}
      {actions ? (
        <GlassContainer
          spacing={8}
          style={[
            styles.actionsContainer,
            {
              bottom: 0,
              height: COMPACT_NAV_HEIGHT,
            },
          ]}
        >
          {actions}
        </GlassContainer>
      ) : null}

      {children}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: 38,
  },
  actionIconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  actionsContainer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    position: "absolute",
    right: 18,
    zIndex: 3,
  },
  compactTitleContainer: {
    alignItems: "center",
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 2,
  },
  compactTitleText: {
    letterSpacing: -0.25,
  },
  expandedTitleText: {
    letterSpacing: -0.45,
  },
  fixedHeaderRoot: {
    backgroundColor: "transparent",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 10,
  },
  glassButtonSurface: {
    borderRadius: 19,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  largeTitleContainer: {
    justifyContent: "center",
    left: 20,
    position: "absolute",
    zIndex: 1,
  },
});
