import { Tabs } from "expo-router/tabs";
import { TabBar, type TabBarProps } from "@ui/tab-bar";
import { ToastViewport } from "@ui/toast";
import { TabBarMinimizeProvider } from "@ui/tab-bar/hooks/use-minimize";
import { useComposer } from "@modules/feeds/hooks/use-composer";
import { useSources } from "@modules/feeds/hooks/use-sources";

export default function TabsLayout() {
  const composer = useComposer();
  const sources = useSources();

  return (
    <TabBarMinimizeProvider>
      <ToastViewport />
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <TabBar {...(props as unknown as TabBarProps)} composer={composer} sources={sources} />
        )}
      >
        <Tabs.Screen name="(inbox)" options={{ title: "My feeds" }} />
        <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      </Tabs>
    </TabBarMinimizeProvider>
  );
}
