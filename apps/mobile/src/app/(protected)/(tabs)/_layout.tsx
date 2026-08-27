import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform } from "react-native";
import { ToastViewport } from "@ui/toast";
import { SearchTabBarProvider } from "@ui/tab-bar/modes/search";
import { ReaderTabBarProvider } from "@ui/tab-bar/modes/reader";

const MATCHA = "#a8d480";
const INACTIVE = "#8a8a8a";

export default function TabsLayout() {
  return (
    <ReaderTabBarProvider>
      <SearchTabBarProvider>
        <ToastViewport />
        <NativeTabs
          iconColor={{ default: INACTIVE, selected: MATCHA }}
          minimizeBehavior="onScrollDown"
          tintColor={MATCHA}
        >
          <NativeTabs.Trigger name="(inbox)">
            <NativeTabs.Trigger.Icon
              md={{ default: "inbox", selected: "inbox" }}
              xcasset={{ default: "board-line", selected: "board-fill" }}
            />
            <NativeTabs.Trigger.Label hidden={Platform.OS === "ios"}>
              Inbox
            </NativeTabs.Trigger.Label>
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
          <NativeTabs.Trigger name="switcher">
            <NativeTabs.Trigger.Icon
              md={{ default: "grid_view", selected: "grid_view" }}
              xcasset={{ default: "selector-line", selected: "selector-fill" }}
            />
            <NativeTabs.Trigger.Label hidden={Platform.OS === "ios"}>
              Sources
            </NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="search" role="search">
            <NativeTabs.Trigger.Label hidden={Platform.OS === "ios"}>
              Search
            </NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      </SearchTabBarProvider>
    </ReaderTabBarProvider>
  );
}
