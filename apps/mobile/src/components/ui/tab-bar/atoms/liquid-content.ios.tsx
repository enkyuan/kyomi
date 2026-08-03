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
import { Pressable, TextInput, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import {
  BackIcon,
  BookmarkIcon,
  CloseIcon,
  ExternalLinkIcon,
  SearchIcon,
  ShareIcon,
} from "@/components/icons";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { FeedTabActions } from "./feed-actions";
import { getFloatingBarPosition, getFloatingBarWidth, styles } from "../lib/styles";
import { useReaderTabBar, type ReaderTabBarConfig } from "../reader-mode";

const ACTION_ICON_SIZE = 19;
const BAR_HEIGHT = 56;
const SIDE_ACTION_WIDTH = 72;
const FEED_TRAILING_WIDTH = 72;
const FEED_GAP = 12;
const READER_GAP = 8;
const GLASS_DEFAULT_SPACING = 6;
const BAR_ANIMATION = Animation.easeInOut({ duration: 0.22 });

type LiquidTabBarContentProps = BottomTabBarProps & {
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
  isReaderRoute,
  navigation,
  state,
}: LiquidTabBarContentProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const { config, isDismissingReader } = useReaderTabBar();
  const inactiveIconColor = String(colors.text);
  const { width: windowWidth } = useWindowDimensions();
  const namespaceId = useId();
  const shouldReduceMotion = useReducedMotion();
  const searchInputRef = useRef<TextInput>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const barPosition = getFloatingBarPosition(insets);
  const barWidth = getFloatingBarWidth(windowWidth, insets);
  const isReaderPresentation = isReaderRoute && !isDismissingReader;
  const isReaderSearchExpanded = isReaderPresentation && isSearchExpanded;
  const gap = isReaderPresentation ? READER_GAP : FEED_GAP;
  const trailingWidth = isReaderPresentation ? SIDE_ACTION_WIDTH : FEED_TRAILING_WIDTH;
  const leadingWidth = isReaderPresentation && !isReaderSearchExpanded ? SIDE_ACTION_WIDTH : 0;
  const primaryWidth = Math.max(
    0,
    barWidth - trailingWidth - gap - (leadingWidth > 0 ? leadingWidth + gap : 0),
  );
  const glassLayoutState = (isReaderPresentation ? 2 : 0) + (isReaderSearchExpanded ? 1 : 0);
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
                active={!isReaderPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={primaryWidth}
              >
                <View accessibilityRole="tablist" style={styles.liquidPrimaryGroup}>
                  <FeedTabActions
                    descriptors={descriptors}
                    navigation={navigation}
                    placement="primary"
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
                />
              </LiquidLayer>
            </LiquidGlassShell>
            <LiquidGlassShell id="trailing" namespaceId={namespaceId} width={trailingWidth}>
              <LiquidLayer
                active={!isReaderPresentation}
                shouldReduceMotion={shouldReduceMotion}
                width={trailingWidth}
              >
                <View accessibilityRole="tablist" style={styles.liquidSeparateGroup}>
                  <FeedTabActions
                    descriptors={descriptors}
                    navigation={navigation}
                    placement="separate"
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
                  {isReaderSearchExpanded ? (
                    <CloseIcon fill={inactiveIconColor} size={ACTION_ICON_SIZE} />
                  ) : (
                    <SearchIcon fill={inactiveIconColor} size={ACTION_ICON_SIZE} />
                  )}
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
          glass: { interactive: false, tint: "rgba(12, 12, 14, 0.5)", variant: "regular" },
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
}: {
  readonly config: ReaderTabBarConfig | null;
  readonly inactiveColor: string;
  readonly isSearchExpanded: boolean;
  readonly searchInputRef: RefObject<TextInput | null>;
}) {
  const isReady = config !== null;

  if (isSearchExpanded) {
    return (
      <View style={styles.readerSearchField}>
        <SearchIcon fill={inactiveColor} size={16} />
        <TextInput
          accessibilityLabel="Find in article"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          editable={isReady}
          onChangeText={config?.onSearchQueryChange}
          placeholder="Find in article"
          placeholderTextColor="#71717a"
          ref={searchInputRef}
          returnKeyType="search"
          selectionColor={kyomiNativeBrand.mizu.color}
          style={styles.readerSearchInput}
          value={config?.searchQuery ?? ""}
        />
      </View>
    );
  }

  return (
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
