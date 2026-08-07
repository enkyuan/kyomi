import { Tabs } from "expo-router/tabs";
import { useCallback, useState, type ComponentProps } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { InboxIcon, RecentsIcon, SettingsIcon, SwitcherIcon } from "@/components/icons";
import { AddCloseIcon } from "@/components/ui/add-icon";
import { AddActionMenu } from "@modules/add/components/action-menu";
import { TabBar } from "@ui/tab-bar";
import { AddTabBarProvider } from "@/components/ui/tab-bar/modes/add";
import { ReaderTabBarProvider } from "@/components/ui/tab-bar/modes/reader";
import { ToastViewport } from "@ui/toast";
import { triggerSelectionHaptic } from "@utils/haptics";

// expo-router bundles its own copy of @react-navigation/bottom-tabs' types,
// structurally identical to the one this app installs directly but not the
// same declaration, so the tabBar render-prop's argument type needs a cast.
type ExpoRouterTabBarProps = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;

export default function TabsLayout() {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const renderTabBar: ExpoRouterTabBarProps = (props) => (
    <TabBar {...(props as unknown as ComponentProps<typeof TabBar>)} />
  );
  const openAddMenu = useCallback(() => {
    void triggerSelectionHaptic();
    setIsAddMenuOpen(true);
  }, []);

  return (
    <ReaderTabBarProvider>
      <AddTabBarProvider>
        <ToastViewport />
        <AddActionMenu isOpen={isAddMenuOpen} onDismiss={() => setIsAddMenuOpen(false)} />
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
              tabBarIcon: ({ color, size }) => (
                <AddCloseIcon
                  active={isAddMenuOpen}
                  color={color}
                  shouldReduceMotion={shouldReduceMotion}
                  size={size}
                />
              ),
            }}
            listeners={{
              tabPress: (event) => {
                event.preventDefault();
                openAddMenu();
              },
            }}
          />
        </Tabs>
      </AddTabBarProvider>
    </ReaderTabBarProvider>
  );
}
