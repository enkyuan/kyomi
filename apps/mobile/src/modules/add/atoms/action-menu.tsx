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
  SEPARATE_ACTION_WIDTH,
  TAB_BAR_HEIGHT,
  TAB_BAR_ICON_SIZE,
  type FloatingBarPosition,
} from "@ui/tab-bar/lib/styles";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";

type AddActionMenuProps = {
  /** Position reported by the live tab bar so the overlay shares the real trigger origin. */
  readonly floatingBarPosition?: FloatingBarPosition;
  readonly isOpen: boolean;
  readonly onCreateFolder: () => void;
  readonly onDismiss: () => void;
  readonly onDismissComplete: () => void;
};

/** Domain composition for the global add action; follow-up flows can be attached per item later. */
export function AddActionMenu({
  floatingBarPosition: tabBarPosition,
  isOpen,
  onCreateFolder,
  onDismiss,
  onDismissComplete,
}: AddActionMenuProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { colors } = useTheme();
  const floatingBarPosition = tabBarPosition ?? getFloatingBarPosition(insets);
  // The action menu darkens its backdrop in both schemes, so its action
  // symbols deliberately retain high contrast rather than inheriting page text.
  const actionIconColor = "#FFFFFF";
  const items = useMemo<readonly ActionMenuItem[]>(
    () => [
      {
        id: "add-feed",
        label: "Add feed",
        icon: <MingcuteIcon fill={actionIconColor} icon={NewsLineNativeIcon} size={26} />,
        onPress: () => router.navigate("/(protected)/(tabs)/add"),
      },
      {
        id: "import-opml",
        label: "Import OPML",
        icon: <MingcuteIcon fill={actionIconColor} icon={FileImportLineNativeIcon} size={26} />,
      },
      {
        id: "create-folder",
        label: "Create folder",
        icon: <MingcuteIcon fill={actionIconColor} icon={Folder2LineNativeIcon} size={26} />,
        onPress: onCreateFolder,
      },
    ],
    [onCreateFolder, router],
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
            className="flex-1 items-center justify-center"
          >
            <AddCloseIcon
              active={isOpen}
              color={colors.text}
              shouldReduceMotion={shouldReduceMotion}
              size={TAB_BAR_ICON_SIZE}
            />
          </Pressable>
        ),
        edgeOffset: floatingBarPosition.right,
        height: TAB_BAR_HEIGHT,
        width: SEPARATE_ACTION_WIDTH,
      }}
      // The same inset drives the tab-bar action and its modal continuation,
      // keeping the close control fixed directly below the last menu action.
      bottomOffset={floatingBarPosition.bottom + TAB_BAR_HEIGHT + 12}
      edgeOffset={floatingBarPosition.right}
      isOpen={isOpen}
      items={items}
      onDismiss={onDismiss}
      onDismissComplete={onDismissComplete}
    />
  );
}
