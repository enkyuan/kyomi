import { useMemo } from "react";
import { useRouter } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import {
  FileImportLineNativeIcon,
  Folder2LineNativeIcon,
  NewsLineNativeIcon,
} from "@kyomi/ui/icons/mingcute-native";
import { MingcuteIcon } from "@/components/icons/mingcute";
import { AddCloseIcon } from "@/components/ui/add-icon";
import { ActionMenu, type ActionMenuItem } from "@ui/action-menu";
import {
  getFloatingBarPosition,
  getTabBarTopEdgeOffset,
  SEPARATE_ACTION_WIDTH,
  TAB_BAR_HEIGHT,
} from "@ui/tab-bar/lib/styles";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";

type AddActionMenuProps = {
  readonly isOpen: boolean;
  readonly onDismiss: () => void;
};

/** Domain composition for the global add action; follow-up flows can be attached per item later. */
export function AddActionMenu({ isOpen, onDismiss }: AddActionMenuProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { colors } = useTheme();
  const floatingBarPosition = getFloatingBarPosition(insets);
  const items = useMemo<readonly ActionMenuItem[]>(
    () => [
      {
        id: "add-feed",
        label: "Add feed",
        icon: <MingcuteIcon icon={NewsLineNativeIcon} />,
        onPress: () => router.navigate("/(protected)/(tabs)/add"),
      },
      {
        id: "import-opml",
        label: "Import OPML",
        icon: <MingcuteIcon icon={FileImportLineNativeIcon} />,
      },
      {
        id: "add-folder",
        label: "Add folder",
        icon: <MingcuteIcon icon={Folder2LineNativeIcon} />,
      },
    ],
    [router],
  );

  return (
    <ActionMenu
      alignment="end"
      anchor={{
        bottomOffset: floatingBarPosition.bottom,
        content: (
          <Pressable
            accessibilityLabel="Close actions menu"
            accessibilityRole="button"
            onPress={onDismiss}
            style={styles.anchorButton}
          >
            <AddCloseIcon
              active={isOpen}
              color={colors.text}
              shouldReduceMotion={shouldReduceMotion}
            />
          </Pressable>
        ),
        edgeOffset: floatingBarPosition.right,
        height: TAB_BAR_HEIGHT,
        width: SEPARATE_ACTION_WIDTH,
      }}
      bottomOffset={getTabBarTopEdgeOffset(insets) + 12}
      edgeOffset={floatingBarPosition.right}
      isOpen={isOpen}
      items={items}
      onDismiss={onDismiss}
    />
  );
}

const styles = StyleSheet.create({
  anchorButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
