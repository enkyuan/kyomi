import type { PropsWithChildren, ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Host, Text } from "@expo/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { GlassView } from "expo-glass-effect";
import { FONT_STYLES } from "@/theme/fonts";
import { COMPACT_NAV_HEIGHT } from "../base";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { ProgressiveBlur } from "@ui/liquid-glass/progressive-blur";

const COMPACT_FADE_START = 24;
const COMPACT_FADE_END = 46;

const EXPANDED_FADE_START = 0;
const EXPANDED_FADE_MID = 28;
const EXPANDED_FADE_END = 48;

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
      <View className="z-[1] items-center justify-center">{icon}</View>
    </>
  );

  if (!onPress) {
    return (
      <View
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className="relative size-[38px] items-center justify-center overflow-hidden rounded-full"
        pointerEvents="none"
        style={[{ opacity: disabled ? 0.4 : 1 }, style]}
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
      className="relative size-[38px] items-center justify-center overflow-hidden rounded-full"
      style={({ pressed }) => [
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
  title: string;
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
  const colorScheme = useColorScheme();
  const { foreground } = getMobileSurfaceTheme(colorScheme);
  const isDark = colorScheme === "dark";
  const shouldReduceMotion = useReducedMotion();

  const totalHeaderHeight = insets.top + COMPACT_NAV_HEIGHT;

  // Large title animation: inline on the left, fades out and translates up on scroll
  const largeTitleStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    const opacity = interpolate(
      y,
      [EXPANDED_FADE_START, EXPANDED_FADE_MID, EXPANDED_FADE_END],
      [1, 0.35, 0],
      Extrapolation.CLAMP,
    );

    if (shouldReduceMotion) {
      return { opacity };
    }

    const translateY = interpolate(
      y,
      [EXPANDED_FADE_START, EXPANDED_FADE_END],
      [0, -8],
      Extrapolation.CLAMP,
    );

    const scale = interpolate(
      y,
      [EXPANDED_FADE_START, EXPANDED_FADE_END],
      [1, 0.96],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  // Centered compact title animation: fades in at center as scroll continues
  const headerBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.max(0, scrollY.value),
      [COMPACT_FADE_START, COMPACT_FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const compactTitleStyle = useAnimatedStyle(() => {
    const y = Math.max(0, scrollY.value);
    const opacity = interpolate(
      y,
      [COMPACT_FADE_START, COMPACT_FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );

    if (shouldReduceMotion) {
      return { opacity };
    }

    const translateY = interpolate(
      y,
      [COMPACT_FADE_START, COMPACT_FADE_END],
      [3, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

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
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, headerBlurStyle]}>
        <ProgressiveBlur
          direction="top"
          intensity={32}
          style={StyleSheet.absoluteFill}
          tint={isDark ? "dark" : "light"}
        />
      </Animated.View>

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
        <Host matchContents>
          <Text
            numberOfLines={1}
            textStyle={{
              ...FONT_STYLES.largeTitle,
              ...styles.expandedTitleText,
              color: foreground,
            }}
          >
            {title}
          </Text>
        </Host>
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
        <Host matchContents>
          <Text
            numberOfLines={1}
            textStyle={{
              ...FONT_STYLES.compactTitle,
              ...styles.compactTitleText,
              color: foreground,
            }}
          >
            {title}
          </Text>
        </Host>
      </Animated.View>

      {/* Trailing Action Controls (Inline on the Right with GlassContainer) */}
      {actions ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.actionsContainer,
            {
              bottom: 0,
              height: COMPACT_NAV_HEIGHT,
            },
          ]}
        >
          {actions}
        </View>
      ) : null}

      {children}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
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
