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
import { useAddTabBar } from "../modes/add";
import { useScrollTabBar } from "../modes/scroll";
import { getFloatingBarPosition, type BottomScreenCornerRadii } from "../lib/styles";
import type { TabBarSurface } from "../lib/types";

type TabBarContentProps = BottomTabBarProps & {
  readonly isAddRoute: boolean;
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
  isAddRoute,
  navigation,
  screenCorners,
  Surface,
}: TabBarContentProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const { config } = useAddTabBar();
  const { isMinimized } = useScrollTabBar();
  const searchInputRef = useRef<SearchFieldRef>(null);
  const isAddPresentation = isAddRoute && config !== null;
  const isMinimizedPresentation = isMinimized && !isAddPresentation;

  useEffect(() => {
    if (!isAddPresentation) {
      return;
    }
    const timeout = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [isAddPresentation]);

  const closeAdd = () => {
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
            ? "h-14 w-18 overflow-hidden rounded-full"
            : "flex-1 overflow-hidden rounded-full"
        }
      >
        <Surface style={{ flex: 1, height: "100%", width: "100%" }}>
          {isAddPresentation && config ? (
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
      {isAddPresentation || hasSeparateFeedTabAction({ descriptors, state }) ? (
        <Animated.View
          layout={shouldReduceMotion ? undefined : ADD_LAYOUT_TRANSITION}
          className="h-14 w-18 overflow-hidden rounded-full"
        >
          <Surface style={{ flex: 1, height: "100%", width: "100%" }}>
            {isAddPresentation ? (
              <Animated.View
                entering={shouldReduceMotion ? undefined : ADD_CONTENT_ENTERING}
                exiting={shouldReduceMotion ? undefined : ADD_CONTENT_EXITING}
                key="close-add-search"
                className="size-full flex-1"
              >
                <Pressable
                  accessibilityLabel="Close feed search"
                  accessibilityRole="button"
                  onPress={closeAdd}
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
