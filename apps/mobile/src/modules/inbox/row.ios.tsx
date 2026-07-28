import { Rss2LineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import {
  resolveNativeMotionEffect,
  type NativeMotionEffect,
  type NativeMotionVisualOutcome,
} from "@kyomi/ui/native/motion";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { Button, HStack, RNHostView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityLabel,
  animation,
  Animation,
  buttonStyle,
  contentShape,
  font,
  foregroundStyle,
  lineLimit,
  listRowBackground,
  listRowInsets,
  padding,
  shapes,
  type ModifierConfig,
} from "@expo/ui/swift-ui/modifiers";

import { MingcuteIcon } from "@/components/icons";

import type { InboxRowProps } from "./model";

function assertNever(effect: never): never {
  throw new Error(`Unhandled native motion effect: ${effect}`);
}

function toSwiftArgbHex(color: string, alpha: number) {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${channel}${color.slice(1)}`;
}

function selectionModifiers(
  outcome: NativeMotionVisualOutcome,
  selected: boolean,
): ModifierConfig[] {
  const color = selected
    ? toSwiftArgbHex(kyomiNativeBrand.matcha.color, outcome.selectedSurfaceAlpha)
    : "clear";
  const effect: NativeMotionEffect = outcome.effect;

  switch (effect) {
    case "selection-surface-fade":
      return [listRowBackground(color), animation(Animation.easeOut({ duration: 0.2 }), selected)];
    case "selection-surface-instant":
      return [listRowBackground(color)];
    default:
      return assertNever(effect);
  }
}

export function InboxRow({ item, onSelect, reducedMotion, selected }: InboxRowProps) {
  const outcome = resolveNativeMotionEffect("selection-change", reducedMotion);

  return (
    <Button
      modifiers={[
        buttonStyle("plain"),
        listRowInsets({ top: 0, bottom: 0, leading: 16, trailing: 16 }),
        accessibilityLabel(`${item.source}. ${item.title}. ${item.summary}. ${item.timestamp}`),
        ...(selected ? [accessibilityAddTraits(["isSelected"])] : []),
        ...selectionModifiers(outcome, selected),
      ]}
      onPress={() => onSelect(item.id)}
    >
      <HStack
        alignment="top"
        modifiers={[contentShape(shapes.rectangle()), padding({ vertical: 14 })]}
        spacing={12}
      >
        <RNHostView matchContents>
          <MingcuteIcon
            color={kyomiNativeBrand.matcha.color}
            decorative
            icon={Rss2LineNativeIcon}
          />
        </RNHostView>
        <VStack alignment="leading" spacing={3}>
          <Text
            modifiers={[
              font({ textStyle: "caption", weight: "semibold" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              lineLimit(1),
            ]}
          >
            {item.source}
          </Text>
          <Text modifiers={[font({ textStyle: "headline" }), lineLimit(2)]}>{item.title}</Text>
          <Text
            modifiers={[
              font({ textStyle: "subheadline" }),
              foregroundStyle({ type: "hierarchical", style: "secondary" }),
              lineLimit(2),
            ]}
          >
            {item.summary}
          </Text>
        </VStack>
        <Spacer minLength={8} />
        <Text
          modifiers={[
            font({ textStyle: "caption2" }),
            foregroundStyle({ type: "hierarchical", style: "tertiary" }),
            lineLimit(1),
          ]}
        >
          {item.timestamp}
        </Text>
      </HStack>
    </Button>
  );
}
