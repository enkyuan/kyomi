import { Tabs } from "expo-router/tabs";
import { useCallback, useRef, useState, type ComponentProps } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { InboxIcon, RecentsIcon, SettingsIcon, SwitcherIcon } from "@/components/icons";
import { AddCloseIcon } from "@ui/add-icon";
import { AddActionMenu } from "@modules/add/atoms/action-menu";
import { CreateFolder } from "@modules/add/atoms/create-folder";
import { TabBar } from "@ui/tab-bar";
import type { FloatingBarPosition } from "@ui/tab-bar/lib/styles";
import { AddTabBarProvider } from "@ui/tab-bar/modes/add";
import { ReaderTabBarProvider } from "@ui/tab-bar/modes/reader";
import { ToastViewport } from "@ui/toast";
import { triggerSelectionHaptic } from "@utils/haptics";

// expo-router bundles its own copy of @react-navigation/bottom-tabs' types,
// structurally identical to the one this app installs directly but not the
// same declaration, so the tabBar render-prop's argument type needs a cast.
type ExpoRouterTabBarProps = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;

export default function TabsLayout() {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const createFolderRequestedRef = useRef(false);
  const [floatingBarPosition, setFloatingBarPosition] = useState<FloatingBarPosition>();
  const shouldReduceMotion = useReducedMotion();
  const updateFloatingBarPosition = useCallback((position: FloatingBarPosition) => {
    setFloatingBarPosition((current) =>
      current &&
      current.bottom === position.bottom &&
      current.left === position.left &&
      current.right === position.right
        ? current
        : position,
    );
  }, []);
  const renderTabBar = useCallback<ExpoRouterTabBarProps>(
    (props) => (
      <TabBar
        {...(props as unknown as ComponentProps<typeof TabBar>)}
        onFloatingBarPositionChange={updateFloatingBarPosition}
      />
    ),
    [updateFloatingBarPosition],
  );
  const openAddMenu = useCallback(() => {
    createFolderRequestedRef.current = false;
    void triggerSelectionHaptic();
    setIsAddMenuOpen(true);
  }, []);
  const requestCreateFolder = useCallback(() => {
    createFolderRequestedRef.current = true;
  }, []);
  const handleAddMenuDismissComplete = useCallback(() => {
    if (!createFolderRequestedRef.current) {
      return;
    }

    createFolderRequestedRef.current = false;
    setIsCreateFolderOpen(true);
  }, []);

  return (
    <ReaderTabBarProvider>
      <AddTabBarProvider>
        <ToastViewport />
        <AddActionMenu
          floatingBarPosition={floatingBarPosition}
          isOpen={isAddMenuOpen}
          onCreateFolder={requestCreateFolder}
          onDismiss={() => setIsAddMenuOpen(false)}
          onDismissComplete={handleAddMenuDismissComplete}
        />
        <CreateFolder
          isPresented={isCreateFolderOpen}
          onDismiss={() => setIsCreateFolderOpen(false)}
        />
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
