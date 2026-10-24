import { Tabs } from "expo-router/tabs";
import { SharedHeaderTitle } from "@ui/header/shared-title-view";
import { SharedHeaderTitleProvider } from "@ui/header/shared-title";
import { TabBar, type TabBarProps } from "@ui/tab-bar";
import { ToastViewport } from "@ui/toast";
import { TabBarMinimizeProvider } from "@ui/tab-bar/hooks/use-minimize";

export default function TabsLayout() {
  return (
    <TabBarMinimizeProvider>
      <SharedHeaderTitleProvider>
        <ToastViewport />
        <Tabs
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
        >
          <Tabs.Screen name="(inbox)" options={{ title: "My feeds" }} />
          <Tabs.Screen name="explore" options={{ title: "Explore" }} />
        </Tabs>
        {/* One title above both screens, so swapping tabs changes it in place. */}
        <SharedHeaderTitle />
      </SharedHeaderTitleProvider>
    </TabBarMinimizeProvider>
  );
}
