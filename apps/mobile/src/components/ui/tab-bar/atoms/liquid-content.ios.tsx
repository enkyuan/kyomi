import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  GlassEffectContainer,
  HStack,
  Host,
  Namespace,
  RNHostView,
  ZStack,
} from "@expo/ui/swift-ui";
import {
  Animation,
  accessibilityHidden,
  animation,
  blur,
  disabled,
  frame,
  glassEffect,
  glassEffectId,
  opacity,
} from "@expo/ui/swift-ui/modifiers";
import { useRouter, useTheme } from "expo-router";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { BackIcon, BookmarkIcon, CloseIcon, ExternalLinkIcon, ShareIcon } from "@/components/icons";
import { AddCloseIcon } from "@/components/ui/add-icon";
import { SearchField, type SearchFieldRef } from "@/components/ui/search-field/atoms";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { FeedTabActions } from "./feed-actions";
import { ReaderSearchToggleIcon } from "./search-toggle.ios";
import { useAddTabBar } from "../add-mode";
import { getFloatingBarPosition, getFloatingBarWidth, styles } from "../lib/styles";
import { useReaderTabBar, type ReaderTabBarConfig } from "../reader-mode";

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

  const barPosition = getFloatingBarPosition(insets);
  const barWidth = getFloatingBarWidth(windowWidth, insets);
  const isReaderPresentation = isReaderRoute && !isDismissingReader;
  const isAddPresentation = isAddRoute && addConfig !== null;
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
    <Host style={[styles.liquidHost, barPosition]}>
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
                <LiquidLayer
                  active
                  shouldReduceMotion={shouldReduceMotion}
                  width={SIDE_ACTION_WIDTH}
                >
                  <ReaderSeparateAction accessibilityLabel="Back to inbox" onPress={goBack}>
                    <BackIcon fill={inactiveIconColor} size={ACTION_ICON_SIZE} />
                  </ReaderSeparateAction>
                </LiquidLayer>
              </LiquidGlassShell>
            ) : null}
            <LiquidGlassShell id="primary" namespaceId={namespaceId} width={primaryWidth}>
              <LiquidLayer
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
              </LiquidLayer>
              <LiquidLayer
                active={isReaderPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={primaryWidth}
              >
                <ReaderPrimaryActions
                  config={config}
                  inactiveColor={inactiveIconColor}
                  isSearchExpanded={isReaderSearchExpanded}
                  searchInputRef={searchInputRef}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </LiquidLayer>
              <LiquidLayer
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
              </LiquidLayer>
            </LiquidGlassShell>
            <LiquidGlassShell id="trailing" namespaceId={namespaceId} width={trailingWidth}>
              <LiquidLayer
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
              </LiquidLayer>
              <LiquidLayer
                active={isReaderPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={trailingWidth}
              >
                <ReaderSeparateAction
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
                </ReaderSeparateAction>
              </LiquidLayer>
              <LiquidLayer
                active={isAddPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={trailingWidth}
              >
                <ReaderSeparateAction accessibilityLabel="Close feed search" onPress={closeAdd}>
                  <AddCloseIcon
                    active
                    color={inactiveIconColor}
                    shouldReduceMotion={shouldReduceMotion}
                  />
                </ReaderSeparateAction>
              </LiquidLayer>
            </LiquidGlassShell>
          </HStack>
        </GlassEffectContainer>
      </Namespace>
    </Host>
  );
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

function LiquidLayer({
  active,
  children,
  shouldReduceMotion,
  width,
}: {
  readonly active: boolean;
  readonly children: ReactNode;
  readonly shouldReduceMotion: boolean;
  readonly width: number;
}) {
  return (
    <ZStack
      modifiers={[
        frame({ height: BAR_HEIGHT, width }),
        opacity(active ? 1 : 0),
        accessibilityHidden(!active),
        disabled(!active),
        ...(shouldReduceMotion ? [] : [blur(active ? 0 : 2), animation(BAR_ANIMATION, active)]),
      ]}
    >
      <RNHostView>
        <View pointerEvents={active ? "auto" : "none"} style={styles.liquidHostedContent}>
          {children}
        </View>
      </RNHostView>
    </ZStack>
  );
}

function ReaderPrimaryActions({
  config,
  inactiveColor,
  isSearchExpanded,
  searchInputRef,
  shouldReduceMotion,
}: {
  readonly config: ReaderTabBarConfig | null;
  readonly inactiveColor: string;
  readonly isSearchExpanded: boolean;
  readonly searchInputRef: RefObject<SearchFieldRef | null>;
  readonly shouldReduceMotion: boolean;
}) {
  const isReady = config !== null;
  // Allow the primary glass capsule to establish its new width before its
  // contents fade in. The outgoing controls leave early, preventing the
  // input from reading as a crossfade over the toolbar actions.
  const entering = shouldReduceMotion ? undefined : FadeIn.delay(36).duration(164);
  const exiting = shouldReduceMotion ? undefined : FadeOut.duration(96);

  if (isSearchExpanded) {
    return (
      <Animated.View
        entering={entering}
        exiting={exiting}
        key="search"
        style={styles.liquidContentLayer}
      >
        <SearchField
          accessibilityLabel="Find in article"
          clearAccessibilityLabel="Clear article search"
          editable={isReady}
          inputRef={searchInputRef}
          onChangeText={config?.onSearchQueryChange}
          placeholder="Find in article"
          value={config?.searchQuery ?? ""}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      key="actions"
      style={styles.liquidContentLayer}
    >
      <View style={styles.readerBar}>
        <ReaderToolbarAction
          accessibilityLabel={config?.isSaved ? "Remove from read later" : "Read later"}
          disabled={!isReady || config.isUpdating}
          onPress={config?.onToggleSaved}
        >
          <BookmarkIcon
            fill={config?.isSaved ? kyomiNativeBrand.mizu.color : inactiveColor}
            focused={config?.isSaved}
            size={ACTION_ICON_SIZE}
          />
        </ReaderToolbarAction>
        <ReaderToolbarAction
          accessibilityLabel="Open source"
          disabled={!isReady}
          onPress={config?.onOpenSource}
        >
          <ExternalLinkIcon fill={inactiveColor} size={ACTION_ICON_SIZE} />
        </ReaderToolbarAction>
        <ReaderToolbarAction
          accessibilityLabel="Share article"
          disabled={!isReady}
          onPress={config?.onShare}
        >
          <ShareIcon fill={inactiveColor} size={ACTION_ICON_SIZE} />
        </ReaderToolbarAction>
      </View>
    </Animated.View>
  );
}

function ReaderToolbarAction({
  accessibilityLabel,
  children,
  disabled: isDisabled,
  onPress,
}: {
  readonly accessibilityLabel: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onPress: (() => void) | undefined;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.readerAction, pressed && styles.readerActionPressed]}
    >
      {children}
    </Pressable>
  );
}

function ReaderSeparateAction({
  accessibilityLabel,
  children,
  disabled: isDisabled = false,
  onPress,
}: {
  readonly accessibilityLabel: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.readerSeparateAction, pressed && styles.readerActionPressed]}
    >
      {children}
    </Pressable>
  );
}
