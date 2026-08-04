import { Tabs } from "expo-router/tabs";
import type { ComponentProps } from "react";
import { InboxIcon, PlusIcon, RecentsIcon, SettingsIcon, SwitcherIcon } from "@/components/icons";
import { TabBar } from "@ui/tab-bar";
import { AddTabBarProvider } from "@ui/tab-bar/add-mode";
import { ReaderTabBarProvider } from "@ui/tab-bar/reader-mode";
import { ToastViewport } from "@ui/toast";

// expo-router bundles its own copy of @react-navigation/bottom-tabs' types,
// structurally identical to the one this app installs directly but not the
// same declaration, so the tabBar render-prop's argument type needs a cast.
type ExpoRouterTabBarProps = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;

export default function TabsLayout() {
  const renderTabBar: ExpoRouterTabBarProps = (props) => (
    <TabBar {...(props as unknown as ComponentProps<typeof TabBar>)} />
  );

  return (
    <ReaderTabBarProvider>
      <AddTabBarProvider>
        <ToastViewport />
        <Tabs screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
          <Tabs.Screen
            name="(inbox)"
            options={{
              tabBarIcon: ({ color, size, focused }) => (
                <InboxIcon fill={color} focused={focused} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="recents"
            options={{
              title: "Recents",
              tabBarIcon: ({ color, size, focused }) => (
                <RecentsIcon fill={color} focused={focused} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: "Settings",
              tabBarAccessibilityLabel: "Settings tab",
              tabBarIcon: ({ color, size, focused }) => (
                <SettingsIcon fill={color} focused={focused} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="switcher"
            options={{
              tabBarIcon: ({ color, size }) => <SwitcherIcon fill={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="add"
            options={{
              tabBarIcon: ({ color, size }) => <PlusIcon fill={color} size={size} />,
            }}
          />
        </Tabs>
      </AddTabBarProvider>
    </ReaderTabBarProvider>
  );
}
