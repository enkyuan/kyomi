import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import type { NativeSyntheticEvent } from "react-native";
import Animated, { useAnimatedProps } from "react-native-reanimated";
import {
  BLODE_STROKE_WIDTH,
  ChevronGrabberVerticalNativeIcon,
  CompassPointerFilledNativeIcon,
  CompassPointerNativeIcon,
  LayoutAlignBottomFilledNativeIcon,
  LayoutAlignBottomNativeIcon,
  MagnifyingGlassNativeIcon,
  PageTextSearchNativeIcon,
  PlusNativeIcon,
  type BlodeNativeIcon,
} from "@kyomi/ui/icons/blode-native";
import { useOptionalTabBarMinimize } from "./hooks/use-minimize";
import { mobileColors } from "@/theme/colors";
import {
  TabBarView,
  type TabBarIcon,
  type TabBarItem,
  type TabBarSwitcher,
} from "../../../../modules/tab-bar";
import type { TabBarProps } from "./lib/types";

/** Maps Blode geometry to the native bar: line glyphs carry their stroke width, filled ones none. */
function toTabBarIcon(icon: BlodeNativeIcon, rotation?: number): TabBarIcon {
  return {
    viewBox: icon.viewBox,
    rotation,
    paths: icon.paths.map((path) => ({
      d: path.d,
      fillRule: path.fillRule,
      strokeWidth: path.stroke ? BLODE_STROKE_WIDTH : undefined,
    })),
  };
}

/** The compass pointer is drawn pointing up; tilt it to the right like a compass needle. */
const EXPLORE_ICON_TILT = 45;

const TABS: readonly TabBarItem[] = [
  {
    key: "inbox",
    label: "Feeds",
    icon: toTabBarIcon(LayoutAlignBottomNativeIcon),
    selectedIcon: toTabBarIcon(LayoutAlignBottomFilledNativeIcon),
  },
  {
    key: "explore",
    label: "Explore articles",
    icon: toTabBarIcon(CompassPointerNativeIcon, EXPLORE_ICON_TILT),
    selectedIcon: toTabBarIcon(CompassPointerFilledNativeIcon, EXPLORE_ICON_TILT),
  },
];

const SEARCH_ICON = toTabBarIcon(PageTextSearchNativeIcon);
const COMPOSER_ICON = toTabBarIcon(MagnifyingGlassNativeIcon);
const ADD_ICON = toTabBarIcon(PlusNativeIcon);

const SWITCHER: TabBarSwitcher = {
  title: "Sources",
  label: "Choose source",
  hint: "Opens folders and feeds",
  icon: toTabBarIcon(ChevronGrabberVerticalNativeIcon),
};

// Animated so the scroll worklet's `minimized` reaches the native bar from the UI thread.
const AnimatedTabBarView = Animated.createAnimatedComponent(TabBarView);

/** Floating tab bar drawn natively in SwiftUI by the local `tab-bar` module. */
export function TabBar({
  navigation,
  composer,
  onSearchQueryChange,
  onSearchSubmit,
  onTabChange,
  state,
}: TabBarProps) {
  const minimizedSV = useOptionalTabBarMinimize()?.minimizedSV;
  // Committed on the UI thread the moment the scroll worklet decides, with no JS round trip and no
  // re-render; SwiftUI animates the change.
  const animatedProps = useAnimatedProps(() => ({ minimized: minimizedSV?.get() ?? false }));
  const selectedIndex = Math.min(Math.max(state?.index ?? 0, 0), TABS.length - 1);

  function handleTabPress({ nativeEvent: { index } }: NativeSyntheticEvent<{ index: number }>) {
    onTabChange?.(index);

    const route = state?.routes[index];
    if (!state || !navigation || !route) return;
    const event = navigation.emit({ canPreventDefault: true, target: route.key, type: "tabPress" });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  }

  return (
    <AnimatedTabBarView
      activeTintColor={mobileColors.matcha}
      addIcon={ADD_ICON}
      addIconColor={kyomiNativeBrand.matcha.onColor}
      animatedProps={animatedProps}
      composerFeeds={composer?.feeds}
      composerIcon={COMPOSER_ICON}
      composerFolders={composer?.folders}
      composerKind={composer?.kind}
      composerMessage={composer?.message ?? undefined}
      composerStatus={composer?.status}
      onComposerActiveChange={({ nativeEvent }) => composer?.onActiveChange(nativeEvent.active)}
      onComposerQueryChange={({ nativeEvent }) => composer?.onQueryChange(nativeEvent.query)}
      onComposerSubmit={({ nativeEvent: { feedId, folderId, url } }) =>
        composer?.onSubmit({ feedId: feedId || undefined, folderId: folderId || undefined, url })
      }
      onSearchQueryChange={({ nativeEvent }) => onSearchQueryChange?.(nativeEvent.query)}
      onSearchSubmit={({ nativeEvent }) => onSearchSubmit?.(nativeEvent.query)}
      onTabPress={handleTabPress}
      searchIcon={SEARCH_ICON}
      searchPlaceholder="Search articles"
      selectedIndex={selectedIndex}
      // Spans the screen so the switcher sheet can grow out of the bar; touches outside the bar
      // pass through natively. Screens reserve only the bar itself (`getTabBarOcclusionHeight`).
      // The bar clears the keyboard natively, so the host never moves with it.
      style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
      switcher={SWITCHER}
      tabs={TABS}
    />
  );
}

export default TabBar;
export type { TabBarProps };
