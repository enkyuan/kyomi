import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter, useTheme } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import { CloseIcon } from "@/components/icons";
import { AddSearchField } from "./add-search-field";
import { FeedTabActions, hasSeparateFeedTabAction } from "./feed-actions";
import { useAddTabBar } from "../add-mode";
import { getFloatingBarPosition, styles } from "../lib/styles";
import type { TabBarSurface } from "../lib/types";

type TabBarContentProps = BottomTabBarProps & {
  readonly isAddRoute: boolean;
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
  Surface,
}: TabBarContentProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const { config } = useAddTabBar();
  const searchInputRef = useRef<TextInput>(null);
  const isAddPresentation = isAddRoute && config !== null;

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
    <View style={[styles.row, getFloatingBarPosition(insets)]}>
      <Animated.View
        layout={shouldReduceMotion ? undefined : ADD_LAYOUT_TRANSITION}
        style={styles.wrapper}
      >
        <Surface style={styles.primarySurface}>
          {isAddPresentation && config ? (
            <Animated.View
              entering={shouldReduceMotion ? undefined : ADD_CONTENT_ENTERING}
              exiting={shouldReduceMotion ? undefined : ADD_CONTENT_EXITING}
              key="add-search"
              style={styles.readerSearchContent}
            >
              <AddSearchField
                config={config}
                inactiveColor={String(colors.text)}
                inputRef={searchInputRef}
              />
            </Animated.View>
          ) : (
            <Animated.View
              entering={shouldReduceMotion ? undefined : ADD_CONTENT_ENTERING}
              exiting={shouldReduceMotion ? undefined : ADD_CONTENT_EXITING}
              key="feed-tabs"
              style={styles.readerSearchContent}
            >
              <View accessibilityRole="tablist" style={styles.bar}>
                <FeedTabActions
                  descriptors={descriptors}
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
          style={styles.separateWrapper}
        >
          <Surface style={styles.separateSurface}>
            {isAddPresentation ? (
              <Animated.View
                entering={shouldReduceMotion ? undefined : ADD_CONTENT_ENTERING}
                exiting={shouldReduceMotion ? undefined : ADD_CONTENT_EXITING}
                key="close-add-search"
                style={styles.readerSearchContent}
              >
                <Pressable
                  accessibilityLabel="Close feed search"
                  accessibilityRole="button"
                  onPress={closeAdd}
                  style={({ pressed }) => [
                    styles.readerSeparateAction,
                    pressed && styles.readerActionPressed,
                  ]}
                >
                  <CloseIcon fill={String(colors.text)} size={19} />
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View
                entering={shouldReduceMotion ? undefined : ADD_CONTENT_ENTERING}
                exiting={shouldReduceMotion ? undefined : ADD_CONTENT_EXITING}
                key="add-tab"
                style={styles.readerSearchContent}
              >
                <View accessibilityRole="tablist" style={styles.separateBar}>
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
