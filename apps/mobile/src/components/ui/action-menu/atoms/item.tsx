import { Pressable, StyleSheet, Text, View } from "react-native";
import { triggerSelectionHaptic } from "@utils/haptics";
import { ACTION_MENU_ICON_SIZE, type ActionMenuItem as ActionMenuItemModel } from "../lib/model";
import { ActionMenuSurface } from "./surface";

type ActionMenuItemProps = {
  readonly alignment: "start" | "end";
  readonly item: ActionMenuItemModel;
  readonly onDismiss: () => void;
  readonly usesLiquidGlass: boolean;
};

/** A content-only action row, intentionally leaving the backdrop to the menu shell. */
export function ActionMenuItem({
  alignment,
  item,
  onDismiss,
  usesLiquidGlass,
}: ActionMenuItemProps) {
  const handlePress = () => {
    void triggerSelectionHaptic();
    item.onPress?.();
    onDismiss();
  };

  return (
    <ActionMenuSurface style={styles.surface} usesLiquidGlass={usesLiquidGlass}>
      <Pressable
        accessibilityLabel={item.accessibilityLabel ?? item.label}
        accessibilityRole="button"
        hitSlop={8}
        onPress={handlePress}
        style={[styles.row, alignment === "end" ? styles.endAligned : styles.startAligned]}
      >
        <View accessible={false} style={styles.icon}>
          {item.icon}
        </View>
        <Text numberOfLines={1} style={styles.label}>
          {item.label}
        </Text>
      </Pressable>
    </ActionMenuSurface>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    columnGap: 12,
    height: 56,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  startAligned: {
    flexDirection: "row",
  },
  endAligned: {
    flexDirection: "row-reverse",
  },
  icon: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: ACTION_MENU_ICON_SIZE / 2,
    height: ACTION_MENU_ICON_SIZE,
    justifyContent: "center",
    width: ACTION_MENU_ICON_SIZE,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },
  surface: {
    borderRadius: 28,
    minWidth: 224,
    overflow: "hidden",
  },
});
