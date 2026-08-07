import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { GlassEffectContainer, HStack, Host, Namespace, ZStack } from "@expo/ui/swift-ui";
import {
  Animation,
  animation,
  frame,
  glassEffect,
  glassEffectId,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter, useTheme } from "expo-router";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { BackIcon } from "@/components/icons";
import { AddCloseIcon } from "@/components/ui/add-icon";
import { SearchField, type SearchFieldRef } from "@/components/ui/search-field/atoms";
import { FeedTabActions } from "./feed-actions";
import {
  LiquidReaderLayer,
  LiquidReaderPrimaryActions,
  LiquidReaderSeparateAction,
} from "./liquid-reader-actions.ios";
import { ReaderSearchToggleIcon } from "./search-toggle.ios";
import { useAddTabBar } from "../modes/add";
import { getFloatingBarPosition, getFloatingBarWidth, styles } from "../lib/styles";
import { useReaderTabBar } from "../modes/reader";

const ACTION_ICON_SIZE = 19;
const BAR_HEIGHT = 56;
const SIDE_ACTION_WIDTH = 72;
const FEED_TRAILING_WIDTH = 72;
const FEED_GAP = 12;
const READER_GAP = 8;
const GLASS_DEFAULT_SPACING = 6;
// The glass effects retain their stable identities while this critically
// damped spring moves the bounds. That keeps the material continuous without
// the elastic overshoot that makes a search field feel disconnected from its
// source action.
const BAR_ANIMATION = Animation.spring({ duration: 0.22, bounce: 0 });

type LiquidTabBarContentProps = BottomTabBarProps & {
  readonly isAddRoute: boolean;
  readonly isReaderRoute: boolean;
};

/**
 * iOS 26 Liquid Glass chrome. The Host remains mounted across inbox and
 * reader routes so SwiftUI can carry the primary and trailing glass effects
 * between their stable IDs instead of crossfading an entire bar.
 */
export function LiquidTabBarContent({
  descriptors,
  insets,
  isAddRoute,
  isReaderRoute,
  navigation,
  state,
}: LiquidTabBarContentProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { config, isDismissingReader } = useReaderTabBar();
  const { config: addConfig } = useAddTabBar();
  const inactiveIconColor = String(colors.text);
  const { width: windowWidth } = useWindowDimensions();
  const namespaceId = useId();
  const shouldReduceMotion = useReducedMotion();
  const searchInputRef = useRef<SearchFieldRef>(null);
  const addSearchInputRef = useRef<SearchFieldRef>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const {
    barPosition,
    barWidth,
    gap,
    glassLayoutState,
    isAddPresentation,
    isReaderPresentation,
    isReaderSearchExpanded,
    primaryWidth,
    trailingWidth,
  } = getLiquidBarLayout({
    hasAddConfig: addConfig !== null,
    insets,
    isAddRoute,
    isDismissingReader,
    isReaderRoute,
    isSearchExpanded,
    windowWidth,
  });
  const isReady = config !== null;

  useEffect(() => {
    if (!isReaderPresentation && isSearchExpanded) {
      config?.onSearchQueryChange("");
      setIsSearchExpanded(false);
    }
  }, [config, isReaderPresentation, isSearchExpanded]);

  useEffect(() => {
    if (!isReaderPresentation || !isSearchExpanded) {
      return;
    }
    const timeout = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [isReaderPresentation, isSearchExpanded]);

  useEffect(() => {
    if (!isAddPresentation) {
      return;
    }
    const timeout = setTimeout(() => addSearchInputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [isAddPresentation]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(protected)/(tabs)/(inbox)");
  };

  const openSearch = () => setIsSearchExpanded(true);
  const closeSearch = () => {
    config?.onSearchQueryChange("");
    setIsSearchExpanded(false);
  };
  const closeAdd = () => {
    addConfig?.onQueryChange("");
    router.replace("/(protected)/(tabs)/(inbox)");
  };

  return (
    <Host
      // The tab bar and the React Native action-menu overlay both use the
      // physical floating-bar inset. Keep SwiftUI from applying a second
      // safe-area transform so their shared trailing action stays fixed.
      ignoreSafeArea="all"
      style={[styles.liquidHost, barPosition]}
    >
      <Namespace id={namespaceId}>
        <GlassEffectContainer
          modifiers={[
            frame({ height: BAR_HEIGHT, width: barWidth }),
            ...(shouldReduceMotion ? [] : [animation(BAR_ANIMATION, glassLayoutState)]),
          ]}
          spacing={GLASS_DEFAULT_SPACING}
        >
          <HStack
            alignment="center"
            modifiers={[frame({ height: BAR_HEIGHT, width: barWidth })]}
            spacing={gap}
          >
            {isReaderPresentation && !isReaderSearchExpanded ? (
              <LiquidGlassShell
                id="reader-back"
                namespaceId={namespaceId}
                width={SIDE_ACTION_WIDTH}
              >
                <LiquidReaderLayer
                  active
                  shouldReduceMotion={shouldReduceMotion}
                  width={SIDE_ACTION_WIDTH}
                >
                  <LiquidReaderSeparateAction accessibilityLabel="Back to inbox" onPress={goBack}>
                    <BackIcon fill={inactiveIconColor} size={ACTION_ICON_SIZE} />
                  </LiquidReaderSeparateAction>
                </LiquidReaderLayer>
              </LiquidGlassShell>
            ) : null}
            <LiquidGlassShell id="primary" namespaceId={namespaceId} width={primaryWidth}>
              <LiquidReaderLayer
                active={!isReaderPresentation && !isAddPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={primaryWidth}
              >
                <View accessibilityRole="tablist" style={styles.liquidPrimaryGroup}>
                  <FeedTabActions
                    descriptors={descriptors}
                    navigation={navigation}
                    placement="primary"
                    shouldReduceMotion={shouldReduceMotion}
                    state={state}
                  />
                </View>
              </LiquidReaderLayer>
              <LiquidReaderLayer
                active={isReaderPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={primaryWidth}
              >
                <LiquidReaderPrimaryActions
                  config={config}
                  inactiveColor={inactiveIconColor}
                  isSearchExpanded={isReaderSearchExpanded}
                  searchInputRef={searchInputRef}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </LiquidReaderLayer>
              <LiquidReaderLayer
                active={isAddPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={primaryWidth}
              >
                {addConfig ? (
                  <Animated.View
                    entering={shouldReduceMotion ? undefined : FadeIn.delay(36).duration(164)}
                    exiting={shouldReduceMotion ? undefined : FadeOut.duration(96)}
                    style={styles.liquidContentLayer}
                  >
                    <SearchField
                      accessibilityLabel="Search feeds"
                      clearAccessibilityLabel="Clear feed search"
                      inputRef={addSearchInputRef}
                      onChangeText={addConfig.onQueryChange}
                      placeholder="Search feeds or paste a URL"
                      value={addConfig.query}
                    />
                  </Animated.View>
                ) : null}
              </LiquidReaderLayer>
            </LiquidGlassShell>
            <LiquidGlassShell id="trailing" namespaceId={namespaceId} width={trailingWidth}>
              <LiquidReaderLayer
                active={!isReaderPresentation && !isAddPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={trailingWidth}
              >
                <View accessibilityRole="tablist" style={styles.liquidSeparateGroup}>
                  <FeedTabActions
                    descriptors={descriptors}
                    navigation={navigation}
                    placement="separate"
                    shouldReduceMotion={shouldReduceMotion}
                    state={state}
                  />
                </View>
              </LiquidReaderLayer>
              <LiquidReaderLayer
                active={isReaderPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={trailingWidth}
              >
                <LiquidReaderSeparateAction
                  accessibilityLabel={
                    isReaderSearchExpanded ? "Close article search" : "Find in article"
                  }
                  disabled={!isReaderSearchExpanded && !isReady}
                  onPress={isReaderSearchExpanded ? closeSearch : openSearch}
                >
                  <ReaderSearchToggleIcon
                    inactiveColor={inactiveIconColor}
                    isSearchExpanded={isReaderSearchExpanded}
                    shouldReduceMotion={shouldReduceMotion}
                  />
                </LiquidReaderSeparateAction>
              </LiquidReaderLayer>
              <LiquidReaderLayer
                active={isAddPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={trailingWidth}
              >
                <LiquidReaderSeparateAction
                  accessibilityLabel="Close feed search"
                  onPress={closeAdd}
                >
                  <AddCloseIcon
                    active
                    color={inactiveIconColor}
                    shouldReduceMotion={shouldReduceMotion}
                  />
                </LiquidReaderSeparateAction>
              </LiquidReaderLayer>
            </LiquidGlassShell>
          </HStack>
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
}

function getLiquidBarLayout({
  hasAddConfig,
  insets,
  isAddRoute,
  isDismissingReader,
  isReaderRoute,
  isSearchExpanded,
  windowWidth,
}: {
  readonly hasAddConfig: boolean;
  readonly insets: BottomTabBarProps["insets"];
  readonly isAddRoute: boolean;
  readonly isDismissingReader: boolean;
  readonly isReaderRoute: boolean;
  readonly isSearchExpanded: boolean;
  readonly windowWidth: number;
}) {
  const barWidth = getFloatingBarWidth(windowWidth, insets);
  const isReaderPresentation = isReaderRoute && !isDismissingReader;
  const isAddPresentation = isAddRoute && hasAddConfig;
  const isReaderSearchExpanded = isReaderPresentation && isSearchExpanded;
  const gap = isReaderPresentation ? READER_GAP : FEED_GAP;
  const trailingWidth = isReaderPresentation ? SIDE_ACTION_WIDTH : FEED_TRAILING_WIDTH;
  const leadingWidth = isReaderPresentation && !isReaderSearchExpanded ? SIDE_ACTION_WIDTH : 0;
  const primaryWidth = Math.max(
    0,
    barWidth - trailingWidth - gap - (leadingWidth > 0 ? leadingWidth + gap : 0),
  );
  const glassLayoutState = isReaderPresentation
    ? 2 + (isReaderSearchExpanded ? 1 : 0)
    : isAddPresentation
      ? 4
      : 0;

  return {
    barPosition: getFloatingBarPosition(insets),
    barWidth,
    gap,
    glassLayoutState,
    isAddPresentation,
    isReaderPresentation,
    isReaderSearchExpanded,
    primaryWidth,
    trailingWidth,
  };
}

function LiquidGlassShell({
  children,
  id,
  namespaceId,
  width,
}: {
  readonly children: ReactNode;
  readonly id: string;
  readonly namespaceId: string;
  readonly width: number;
}) {
  return (
    <ZStack
      modifiers={[
        frame({ height: BAR_HEIGHT, width }),
        glassEffect({
          // Native interactive glass draws its own circular touch ripple on top
          // of RN's Pressable, which already supplies pressed-state feedback
          // (readerActionPressed / AnimatedTab) — interactive:true double-shows
          // both, and the native ripple reads as a stray circle inside the pill.
          glass: { interactive: false, variant: "regular" },
          shape: "capsule",
        }),
        glassEffectId(id, namespaceId),
      ]}
    >
      {children}
    </ZStack>
  );
}
