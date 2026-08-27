import { Tabs } from "expo-router/tabs";
import { TabBar, type TabBarProps } from "@ui/tab-bar";
import { ToastViewport } from "@ui/toast";
import { SearchTabProvider } from "@ui/tab-bar/components/search-tab";
import { ReaderTabProvider } from "@ui/tab-bar/components/reader-tab";

export default function TabsLayout() {
  return (
    <ReaderTabProvider>
      <SearchTabProvider>
        <ToastViewport />
        <Tabs
          screenOptions={{ headerShown: false }}
          tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
        >
          <Tabs.Screen name="(inbox)" options={{ title: "My feeds" }} />
          <Tabs.Screen name="all" options={{ title: "All" }} />
          <Tabs.Screen name="switcher" options={{ title: "Sources" }} />
        </Tabs>
      </SearchTabProvider>
    </ReaderTabProvider>
  );
}
