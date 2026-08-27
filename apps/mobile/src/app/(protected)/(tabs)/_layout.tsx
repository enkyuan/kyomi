import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";
import { ToastViewport } from "@ui/toast";
import { AddTabBarProvider } from "@ui/tab-bar/modes/add";
import { ReaderTabBarProvider } from "@ui/tab-bar/modes/reader";

const MATCHA = "#a8d480";
const INACTIVE = "#8a8a8a";

export default function TabsLayout() {
  return (
    <ReaderTabBarProvider>
      <AddTabBarProvider>
        <ToastViewport />
        <NativeTabs iconColor={{ default: INACTIVE, selected: MATCHA }} tintColor={MATCHA}>
          <NativeTabs.Trigger name="(inbox)">
            <NativeTabs.Trigger.Icon
              md={{ default: "inbox", selected: "inbox" }}
              xcasset={{ default: "board-line", selected: "board-fill" }}
            />
            <NativeTabs.Trigger.Label hidden={Platform.OS === "ios"}>Home</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="recents">
            <NativeTabs.Trigger.Icon
              md={{ default: "history", selected: "history" }}
              xcasset={{ default: "album-2-line", selected: "album-2-fill" }}
            />
            <NativeTabs.Trigger.Label hidden={Platform.OS === "ios"}>
              Recents
            </NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="settings">
            <NativeTabs.Trigger.Icon
              md={{ default: "settings", selected: "settings" }}
              xcasset={{ default: "bookmark-line", selected: "bookmark-fill" }}
            />
            <NativeTabs.Trigger.Label hidden={Platform.OS === "ios"}>
              Settings
            </NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="switcher">
            <NativeTabs.Trigger.Icon
              md={{ default: "grid_view", selected: "grid_view" }}
              sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
            />
            <NativeTabs.Trigger.Label hidden={Platform.OS === "ios"}>
              Sources
            </NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="add">
            <NativeTabs.Trigger.Icon
              md={{ default: "add_circle", selected: "add_circle" }}
              sf={{ default: "plus.circle", selected: "plus.circle.fill" }}
            />
            <NativeTabs.Trigger.Label hidden={Platform.OS === "ios"}>Add</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      </AddTabBarProvider>
    </ReaderTabBarProvider>
  );
}
