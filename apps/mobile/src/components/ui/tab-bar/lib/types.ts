import type { ComposedGesture, GestureType } from "react-native-gesture-handler";
import type { ViewStyle } from "react-native";
import type { AnimatedStyle, SharedValue } from "react-native-reanimated";

export interface TabBarNavigationRoute {
  key: string;
  name: string;
  params?: unknown;
}

export interface TabBarNavigationState {
  index: number;
  routes: TabBarNavigationRoute[];
}

export interface TabBarNavigation {
  emit: (event: unknown) => {
    defaultPrevented: boolean;
  };
  navigate: (name: string, params?: unknown) => void;
}

export interface TabBarProps {
  readonly state?: TabBarNavigationState;
  readonly descriptors?: Record<string, unknown>;
  readonly navigation?: TabBarNavigation;
  readonly onTabChange?: (index: number) => void;
  readonly onAddPress?: () => void;
  readonly onSearchQueryChange?: (query: string) => void;
  readonly onSearchSubmit?: (query: string) => void;
  readonly [key: string]: unknown;
}

export interface TabBarPillProps {
  readonly activeTab: number;
  readonly onTabPress: (index: number) => void;
  readonly searchProgress: SharedValue<number>;
  readonly pillAnimatedStyle: AnimatedStyle<ViewStyle>;
  readonly pillPressed: SharedValue<number>;
  readonly overflowX: SharedValue<number>;
  readonly overflowY: SharedValue<number>;
  readonly touchX: SharedValue<number>;
  readonly touchY: SharedValue<number>;
  readonly glowProgress: SharedValue<number>;
  readonly panGesture: ComposedGesture | GestureType;
}
