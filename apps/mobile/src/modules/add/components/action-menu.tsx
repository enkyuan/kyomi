import { useMemo } from "react";
import { useRouter } from "expo-router";
import {
  FileImportLineNativeIcon,
  Folder2LineNativeIcon,
  Rss2LineNativeIcon,
} from "@kyomi/ui/icons/mingcute-native";
import { MingcuteIcon } from "@/components/icons/mingcute";
import { ActionMenu, type ActionMenuItem } from "@ui/action-menu";
import { getTabBarTopEdgeOffset } from "@ui/tab-bar/lib/styles";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AddActionMenuProps = {
  readonly isOpen: boolean;
  readonly onDismiss: () => void;
};

/** Domain composition for the global add action; follow-up flows can be attached per item later. */
export function AddActionMenu({ isOpen, onDismiss }: AddActionMenuProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const items = useMemo<readonly ActionMenuItem[]>(
    () => [
      {
        id: "add-feed",
        label: "Add feed",
        icon: <MingcuteIcon icon={Rss2LineNativeIcon} />,
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
      bottomOffset={getTabBarTopEdgeOffset(insets) + 12}
      isOpen={isOpen}
      items={items}
      onDismiss={onDismiss}
    />
  );
}
