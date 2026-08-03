import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "expo-router/react-navigation";
import { triggerSelectionHaptic } from "@utils/haptics";
import { AnimatedTab } from "./animated-tab";

const SEPARATE_ROUTE_NAMES = new Set(["add"]);
const NO_ACTIVE_COLOR_ROUTE_NAMES = new Set(["switcher"]);

type FeedTabActionsProps = Pick<BottomTabBarProps, "descriptors" | "navigation" | "state"> & {
  readonly placement: "primary" | "separate";
};

/**
 * The routed feed actions, independent of their surrounding material surface.
 * Keeping this group separate lets iOS retain the same controls while its
 * Liquid Glass shell changes between inbox and reader modes.
 */
export function FeedTabActions({ descriptors, navigation, placement, state }: FeedTabActionsProps) {
  const { colors } = useTheme();
  const routes = state.routes.filter((route) => {
    if (descriptors[route.key].options.tabBarIcon === undefined) {
      return false;
    }

    const isSeparate = SEPARATE_ROUTE_NAMES.has(route.name);
    return placement === "separate" ? isSeparate : !isSeparate;
  });

  return routes.map((route) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === state.routes.indexOf(route);

    function onPress() {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        void triggerSelectionHaptic();
        navigation.navigate(route.name, route.params);
      }
    }

    function onLongPress() {
      navigation.emit({ type: "tabLongPress", target: route.key });
    }

    return (
      <AnimatedTab
        accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title ?? route.name}
        colors={colors}
        isFocused={isFocused}
        key={route.key}
        onLongPress={onLongPress}
        onPress={onPress}
        options={options}
        showsActiveColor={!NO_ACTIVE_COLOR_ROUTE_NAMES.has(route.name)}
        testID={options.tabBarButtonTestID}
      />
    );
  });
}

export function hasSeparateFeedTabAction({
  descriptors,
  state,
}: Pick<BottomTabBarProps, "descriptors" | "state">) {
  return state.routes.some(
    (route) =>
      descriptors[route.key].options.tabBarIcon !== undefined &&
      SEPARATE_ROUTE_NAMES.has(route.name),
  );
}
