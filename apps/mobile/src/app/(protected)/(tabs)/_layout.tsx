import { Tabs } from "expo-router/tabs";
import { TabBar, type TabBarProps } from "@ui/tab-bar";
import { ToastViewport } from "@ui/toast";
import { SearchTabProvider } from "@ui/tab-bar/components/search-tab";
import { ReaderTabProvider } from "@ui/tab-bar/components/reader-tab";
import { TabBarMinimizeProvider, useTabBarMinimize } from "@ui/tab-bar/hooks/use-minimize";

function TabBarWithMinimize(props: TabBarProps) {
  const { minimized } = useTabBarMinimize();
  return <TabBar {...props} minimized={minimized} />;
}

export default function TabsLayout() {
  return (
    <ReaderTabProvider>
      <SearchTabProvider>
        <TabBarMinimizeProvider>
          <ToastViewport />
          <Tabs
            screenOptions={{ headerShown: false }}
            tabBar={(props) => <TabBarWithMinimize {...(props as unknown as TabBarProps)} />}
          >
            <Tabs.Screen name="(inbox)" options={{ title: "My feeds" }} />
            <Tabs.Screen name="all" options={{ title: "All" }} />
          </Tabs>
        </TabBarMinimizeProvider>
      </SearchTabProvider>
    </ReaderTabProvider>
  );
}
