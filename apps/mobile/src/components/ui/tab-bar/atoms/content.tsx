import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter, useTheme } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import { AddCloseIcon } from "@/components/ui/add-icon";
import { SearchField, type SearchFieldRef } from "@/components/ui/search-field/atoms";
import { FeedTabActions, hasSeparateFeedTabAction } from "./feed-actions";
import { useSearchTabBar } from "../modes/search";
import { useScrollTabBar } from "../modes/scroll";
import { getFloatingBarPosition, type BottomScreenCornerRadii } from "../lib/styles";
import type { TabBarSurface } from "../lib/types";

type TabBarContentProps = BottomTabBarProps & {
  readonly isSearchRoute: boolean;
  readonly screenCorners?: BottomScreenCornerRadii;
  Surface: TabBarSurface;
};

const ADD_LAYOUT_TRANSITION = LinearTransition.duration(220);
const ADD_CONTENT_ENTERING = FadeIn.delay(36).duration(164);
const ADD_CONTENT_EXITING = FadeOut.duration(96);

/** Shared tab content so iOS can swap only its backdrop for native glass. */
export function TabBarContent({
  state,
  descriptors,
  insets,
  isSearchRoute,
  navigation,
  screenCorners,
  Surface,
}: TabBarContentProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const { config } = useSearchTabBar();
  const { isMinimized } = useScrollTabBar();
  const searchInputRef = useRef<SearchFieldRef>(null);
  const isSearchPresentation = isSearchRoute && config !== null;
  const isMinimizedPresentation = isMinimized && !isSearchPresentation;

  useEffect(() => {
    if (!isSearchPresentation) {
      return;
    }
    const timeout = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [isSearchPresentation]);

  const closeSearch = () => {
    config?.onQueryChange("");
    router.replace("/(protected)/(tabs)/(inbox)");
  };

  return (
    <View
      className="absolute flex-row items-center justify-center gap-3"
      style={getFloatingBarPosition(insets, screenCorners)}
    >
      <Animated.View
        layout={shouldReduceMotion ? undefined : ADD_LAYOUT_TRANSITION}
        className={
          isMinimizedPresentation
            ? "h-14 w-14 overflow-hidden rounded-full"
            : "flex-1 overflow-hidden rounded-full"
        }
      >
        <Surface style={{ flex: 1, height: "100%", width: "100%" }}>
          {isSearchPresentation && config ? (
            <Animated.View
              entering={shouldReduceMotion ? undefined : ADD_CONTENT_ENTERING}
              exiting={shouldReduceMotion ? undefined : ADD_CONTENT_EXITING}
              key="add-search"
              className="size-full flex-1"
            >
              <SearchField
                accessibilityLabel="Search feeds"
                clearAccessibilityLabel="Clear feed search"
                inputRef={searchInputRef}
                onChangeText={config.onQueryChange}
                placeholder="Search feeds or paste a URL"
                value={config.query}
              />
            </Animated.View>
          ) : (
            <Animated.View
              entering={shouldReduceMotion ? undefined : ADD_CONTENT_ENTERING}
              exiting={shouldReduceMotion ? undefined : ADD_CONTENT_EXITING}
              key="feed-tabs"
              className="size-full flex-1"
            >
              <View accessibilityRole="tablist" className="h-14 flex-row">
                <FeedTabActions
                  descriptors={descriptors}
                  isMinimized={isMinimizedPresentation}
                  navigation={navigation}
                  placement="primary"
                  shouldReduceMotion={shouldReduceMotion}
                  state={state}
                />
              </View>
            </Animated.View>
          )}
        </Surface>
      </Animated.View>
      {isSearchPresentation || hasSeparateFeedTabAction({ descriptors, state }) ? (
        <Animated.View
          layout={shouldReduceMotion ? undefined : ADD_LAYOUT_TRANSITION}
          className="h-14 w-14 overflow-hidden rounded-full"
        >
          <Surface style={{ flex: 1, height: "100%", width: "100%" }}>
            {isSearchPresentation ? (
              <Animated.View
                entering={shouldReduceMotion ? undefined : ADD_CONTENT_ENTERING}
                exiting={shouldReduceMotion ? undefined : ADD_CONTENT_EXITING}
                key="close-add-search"
                className="size-full flex-1"
              >
                <Pressable
                  accessibilityLabel="Close feed search"
                  accessibilityRole="button"
                  onPress={closeSearch}
                  className="size-full items-center justify-center rounded-full active:bg-[rgba(255,255,255,0.12)]"
                >
                  <AddCloseIcon
                    active
                    color={String(colors.text)}
                    shouldReduceMotion={shouldReduceMotion}
                  />
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View
                entering={shouldReduceMotion ? undefined : ADD_CONTENT_ENTERING}
                exiting={shouldReduceMotion ? undefined : ADD_CONTENT_EXITING}
                key="add-tab"
                className="size-full flex-1"
              >
                <View accessibilityRole="tablist" className="flex-1">
                  <FeedTabActions
                    descriptors={descriptors}
                    navigation={navigation}
                    placement="separate"
                    shouldReduceMotion={shouldReduceMotion}
                    state={state}
                  />
                </View>
              </Animated.View>
            )}
          </Surface>
        </Animated.View>
      ) : null}
    </View>
  );
}
