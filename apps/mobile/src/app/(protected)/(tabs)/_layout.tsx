import { Tabs } from "expo-router/tabs";
import { TabBar, type TabBarProps } from "@ui/tab-bar";
import { ToastViewport } from "@ui/toast";
import { TabBarMinimizeProvider } from "@ui/tab-bar/hooks/use-minimize";

export default function TabsLayout() {
  return (
    <TabBarMinimizeProvider>
      <ToastViewport />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
      >
        <Tabs.Screen name="(inbox)" options={{ title: "My feeds" }} />
        <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      </Tabs>
    </TabBarMinimizeProvider>
  );
}
