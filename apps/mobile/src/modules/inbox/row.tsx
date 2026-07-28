import { Rss2LineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import {
  resolveNativeMotionEffect,
  type NativeMotionEffect,
  type NativeMotionVisualOutcome,
} from "@kyomi/ui/native/motion";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";

import { MingcuteIcon } from "@/components/mingcute-icon";

import type { InboxRowProps } from "./model";

function assertNever(effect: never): never {
  throw new Error(`Unhandled native motion effect: ${effect}`);
}

function useSelectionOpacity(
  outcome: NativeMotionVisualOutcome,
  selected: boolean,
): Animated.Value {
  const opacity = useRef(new Animated.Value(selected ? outcome.selectedSurfaceAlpha : 0)).current;

  useEffect(() => {
    const targetOpacity = selected ? outcome.selectedSurfaceAlpha : 0;
    const effect: NativeMotionEffect = outcome.effect;

    switch (effect) {
      case "selection-surface-fade": {
        const animation = Animated.timing(opacity, {
          duration: 180,
          toValue: targetOpacity,
          useNativeDriver: false,
        });
        animation.start();
        return () => animation.stop();
      }
      case "selection-surface-instant":
        opacity.stopAnimation();
        opacity.setValue(targetOpacity);
        return;
      default:
        return assertNever(effect);
    }
  }, [opacity, outcome.effect, outcome.selectedSurfaceAlpha, selected]);

  return opacity;
}

export function InboxRow({ item, onSelect, reducedMotion, selected }: InboxRowProps) {
  const dark = useColorScheme() === "dark";
  const outcome = resolveNativeMotionEffect("selection-change", reducedMotion);
  const selectionOpacity = useSelectionOpacity(outcome, selected);

  return (
    <View style={[styles.surface, dark && styles.surfaceDark]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: kyomiNativeBrand.matcha.color,
            opacity: selectionOpacity,
          },
        ]}
      />
      <Pressable
        accessibilityLabel={`${item.source}. ${item.title}. ${item.summary}. ${item.timestamp}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onSelect(item.id)}
        style={styles.row}
      >
        <MingcuteIcon color={kyomiNativeBrand.matcha.color} decorative icon={Rss2LineNativeIcon} />
        <View style={styles.content}>
          <Text numberOfLines={1} style={[styles.source, dark && styles.sourceDark]}>
            {item.source}
          </Text>
          <Text numberOfLines={2} style={[styles.title, dark && styles.titleDark]}>
            {item.title}
          </Text>
          <Text numberOfLines={2} style={[styles.summary, dark && styles.summaryDark]}>
            {item.summary}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.timestamp, dark && styles.summaryDark]}>
          {item.timestamp}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: "relative",
    width: "100%",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: "#ffffff",
  },
  surfaceDark: {
    borderBottomColor: "#303033",
    backgroundColor: "#111113",
  },
  row: {
    minHeight: 104,
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  content: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  source: {
    color: "#59616d",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  sourceDark: {
    color: "#a6adb8",
  },
  title: {
    color: "#17181a",
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20,
  },
  titleDark: {
    color: "#f7f7f8",
  },
  summary: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 19,
  },
  summaryDark: {
    color: "#a6adb8",
  },
  timestamp: {
    color: "#7b8491",
    fontSize: 11,
    lineHeight: 16,
  },
});
