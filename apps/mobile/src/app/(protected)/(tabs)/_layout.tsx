import { Tabs } from "expo-router/tabs";
import { Easing } from "react-native";
import { TabBar, type TabBarProps } from "@ui/tab-bar";
import { ToastViewport } from "@ui/toast";
import { TabBarMinimizeProvider } from "@ui/tab-bar/hooks/use-minimize";

/**
 * Switching tabs shifts the screens a little towards the tab being left (React Navigation's
 * `shift`: the departing screen slides and fades out as the arriving one slides and fades in from
 * the other side), so each screen's header title travels with its screen like a navigation bar's.
 * The spec is UIKit's navigation curve and a little longer than the 150ms default.
 */
const TAB_TRANSITION = {
  animation: "shift",
  transitionSpec: {
    animation: "timing",
    config: { duration: 300, easing: Easing.bezier(0.2, 0, 0, 1) },
  },
} as const;

export default function TabsLayout() {
  return (
    <TabBarMinimizeProvider>
      <ToastViewport />
      <Tabs
        screenOptions={{ ...TAB_TRANSITION, headerShown: false }}
        tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
      >
        <Tabs.Screen name="(inbox)" options={{ title: "My feeds" }} />
        <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      </Tabs>
    </TabBarMinimizeProvider>
  );
}
