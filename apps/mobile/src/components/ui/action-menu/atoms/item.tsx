import { BlurView } from "expo-blur";
import { Pressable, Text, View } from "react-native";
import { triggerSelectionHaptic } from "@utils/haptics";
import type { ActionMenuItem as ActionMenuItemModel } from "../lib/model";

type ActionMenuItemProps = {
  readonly alignment: "start" | "end";
  readonly item: ActionMenuItemModel;
  readonly onDismiss: () => void;
};

/** A single end-aligned action row with its own high-contrast icon control. */
export function ActionMenuItem({ alignment, item, onDismiss }: ActionMenuItemProps) {
  const handlePress = () => {
    void triggerSelectionHaptic();
    item.onPress?.();
    onDismiss();
  };

  return (
    <Pressable
      accessibilityLabel={item.accessibilityLabel ?? item.label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={handlePress}
      className={
        alignment === "end"
          ? "h-16 min-w-70 flex-row items-center justify-end gap-3 active:scale-[0.96] active:opacity-[0.72]"
          : "h-16 min-w-70 flex-row-reverse items-center justify-end gap-3 active:scale-[0.96] active:opacity-[0.72]"
      }
    >
      <Text
        numberOfLines={1}
        className={
          alignment === "end"
            ? "min-w-0 shrink text-right text-xl font-semibold leading-6 text-white"
            : "min-w-0 shrink text-left text-xl font-semibold leading-6 text-white"
        }
      >
        {item.label}
      </Text>
      <BlurView
        accessible={false}
        intensity={72}
        className="size-14 items-center justify-center overflow-hidden rounded-full border border-white/[0.14] bg-[rgba(255,255,255,0.18)]"
        tint="systemThickMaterialDark"
      >
        <View accessible={false} className="translate-y-[-0.5px]">
          {item.icon}
        </View>
      </BlurView>
    </Pressable>
  );
}
