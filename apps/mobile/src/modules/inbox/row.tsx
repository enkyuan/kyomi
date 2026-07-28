import { Rss2LineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import {
  resolveNativeMotionEffect,
  type NativeMotionEffect,
  type NativeMotionVisualOutcome,
} from "@kyomi/ui/native/motion";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

import { MingcuteIcon } from "@/components/icons";

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
  const themedMatcha = useCSSVariable("--color-matcha");
  const matcha = typeof themedMatcha === "string" ? themedMatcha : kyomiNativeBrand.matcha.color;
  const outcome = resolveNativeMotionEffect("selection-change", reducedMotion);
  const selectionOpacity = useSelectionOpacity(outcome, selected);

  return (
    <View className="relative w-full border-b border-border bg-background">
      <Animated.View
        className="absolute inset-0 bg-matcha"
        pointerEvents="none"
        style={{ opacity: selectionOpacity }}
      />
      <Pressable
        accessibilityLabel={`${item.source}. ${item.title}. ${item.summary}. ${item.timestamp}`}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        className="min-h-[104px] w-full flex-row items-start gap-3 px-4 py-3.5 active:opacity-60"
        onPress={() => onSelect(item.id)}
      >
        <MingcuteIcon color={matcha} decorative icon={Rss2LineNativeIcon} />
        <View className="min-w-0 flex-1 gap-[3px]">
          <Text className="font-sans-semibold text-xs/4 text-muted-foreground" numberOfLines={1}>
            {item.source}
          </Text>
          <Text className="font-sans-semibold text-base/5 text-foreground" numberOfLines={2}>
            {item.title}
          </Text>
          <Text className="font-sans text-sm/[19px] text-muted-foreground" numberOfLines={2}>
            {item.summary}
          </Text>
        </View>
        <Text className="font-sans text-[11px]/4 text-muted-foreground" numberOfLines={1}>
          {item.timestamp}
        </Text>
      </Pressable>
    </View>
  );
}
