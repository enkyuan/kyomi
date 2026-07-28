import { Rss2LineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import {
  resolveNativeMotionEffect,
  type NativeMotionEffect,
  type NativeMotionVisualOutcome,
} from "@kyomi/ui/native/motion";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { ListItem, RNHostView, Text } from "@expo/ui/jetpack-compose";
import {
  background,
  selectable,
  snap,
  tween,
  type ModifierConfig,
} from "@expo/ui/jetpack-compose/modifiers";

import { MingcuteIcon } from "@/components/icons";

import type { InboxRowProps } from "./model";

function assertNever(effect: never): never {
  throw new Error(`Unhandled native motion effect: ${effect}`);
}

function toRgba(color: string, alpha: number) {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function selectionModifiers(
  outcome: NativeMotionVisualOutcome,
  selected: boolean,
  onPress: () => void,
): ModifierConfig[] {
  const color = selected
    ? toRgba(kyomiNativeBrand.matcha.color, outcome.selectedSurfaceAlpha)
    : "transparent";
  const effect: NativeMotionEffect = outcome.effect;

  switch (effect) {
    case "selection-surface-fade":
      return [
        background(color, {
          animationSpec: tween({ durationMillis: 180, easing: "fastOutSlowIn" }),
        }),
        selectable(selected, onPress),
      ];
    case "selection-surface-instant":
      return [background(color, { animationSpec: snap() }), selectable(selected, onPress)];
    default:
      return assertNever(effect);
  }
}

export function InboxRow({ item, onSelect, reducedMotion, selected }: InboxRowProps) {
  const outcome = resolveNativeMotionEffect("selection-change", reducedMotion);

  return (
    <ListItem
      colors={{ containerColor: "transparent" }}
      modifiers={selectionModifiers(outcome, selected, () => onSelect(item.id))}
      shadowElevation={0}
      tonalElevation={0}
    >
      <ListItem.OverlineContent>
        <Text maxLines={1} overflow="ellipsis" style={{ typography: "labelMedium" }}>
          {item.source}
        </Text>
      </ListItem.OverlineContent>
      <ListItem.HeadlineContent>
        <Text maxLines={2} overflow="ellipsis" style={{ typography: "titleMedium" }}>
          {item.title}
        </Text>
      </ListItem.HeadlineContent>
      <ListItem.SupportingContent>
        <Text maxLines={2} overflow="ellipsis" style={{ typography: "bodyMedium" }}>
          {item.summary}
        </Text>
      </ListItem.SupportingContent>
      <ListItem.LeadingContent>
        <RNHostView matchContents>
          <MingcuteIcon
            color={kyomiNativeBrand.matcha.color}
            decorative
            icon={Rss2LineNativeIcon}
          />
        </RNHostView>
      </ListItem.LeadingContent>
      <ListItem.TrailingContent>
        <Text maxLines={1} overflow="ellipsis" style={{ typography: "labelSmall" }}>
          {item.timestamp}
        </Text>
      </ListItem.TrailingContent>
    </ListItem>
  );
}
