import { BlurView } from "expo-blur";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { triggerSelectionHaptic } from "@utils/haptics";
import { ACTION_MENU_ICON_SIZE, type ActionMenuItem as ActionMenuItemModel } from "../lib/model";

const ICON_TINT = "rgba(255, 255, 255, 0.18)";

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
      style={({ pressed }) => [
        styles.row,
        alignment === "end" ? styles.endAligned : styles.startAligned,
        pressed && styles.pressed,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.label, alignment === "end" ? styles.endLabel : styles.startLabel]}
      >
        {item.label}
      </Text>
      <BlurView
        accessible={false}
        intensity={72}
        style={styles.iconSlot}
        tint="systemThickMaterialDark"
      >
        <View accessible={false} style={styles.iconContent}>
          {item.icon}
        </View>
      </BlurView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    columnGap: 12,
    flexDirection: "row",
    height: 64,
    justifyContent: "flex-end",
    minWidth: 280,
  },
  startAligned: {
    flexDirection: "row-reverse",
  },
  endAligned: {
    flexDirection: "row",
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  iconSlot: {
    alignItems: "center",
    backgroundColor: ICON_TINT,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: ACTION_MENU_ICON_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    height: ACTION_MENU_ICON_SIZE,
    justifyContent: "center",
    overflow: "hidden",
    width: ACTION_MENU_ICON_SIZE,
  },
  iconContent: {
    transform: [{ translateY: -0.5 }],
  },
  label: {
    color: "#FFFFFF",
    flexShrink: 1,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 24,
  },
  startLabel: {
    textAlign: "left",
  },
  endLabel: {
    textAlign: "right",
  },
});
