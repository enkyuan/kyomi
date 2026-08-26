import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter, useTheme } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from "react-native-reanimated";
import {
  BackIcon,
  BookmarkIcon,
  CloseIcon,
  ExternalLinkIcon,
  ListSearchIcon,
  ShareIcon,
} from "@/components/icons";
import { SearchField, type SearchFieldRef } from "@/components/ui/search-field/atoms";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { useReaderTabBar } from "../modes/reader";
import { getFloatingBarPosition, type BottomScreenCornerRadii } from "../lib/styles";
import type { TabBarSurface } from "../lib/types";

const ACTION_ICON_SIZE = 19;
const READER_LAYOUT_TRANSITION = LinearTransition.duration(220);
const READER_CONTENT_ENTERING = FadeIn.delay(36).duration(164);
const READER_CONTENT_EXITING = FadeOut.duration(96);

export function ReaderTabBarContent({
  insets,
  screenCorners,
  Surface,
}: {
  readonly insets: BottomTabBarProps["insets"];
  readonly screenCorners?: BottomScreenCornerRadii;
  readonly Surface: TabBarSurface;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const inactiveIconColor = String(colors.text);
  const { config } = useReaderTabBar();
  const searchInputRef = useRef<SearchFieldRef>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const isReady = config !== null;

  useEffect(() => {
    if (!isSearchExpanded) {
      return;
    }
    const timeout = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [isSearchExpanded]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(protected)/(tabs)/(inbox)");
  };

  const closeSearch = () => {
    config?.onSearchQueryChange("");
    setIsSearchExpanded(false);
  };

  return (
    <View
      accessibilityRole="toolbar"
      pointerEvents="box-none"
      className="absolute flex-row items-center gap-2"
      style={getFloatingBarPosition(insets, screenCorners)}
    >
      <ReaderSeparateAction
        accessibilityLabel="Back to inbox"
        onPress={goBack}
        shouldAnimate={!shouldReduceMotion}
        Surface={Surface}
      >
        <BackIcon fill={inactiveIconColor} size={ACTION_ICON_SIZE} />
      </ReaderSeparateAction>
      <ReaderPrimarySurface
        Surface={Surface}
        config={config}
        inactiveIconColor={inactiveIconColor}
        isReady={isReady}
        isSearchExpanded={isSearchExpanded}
        searchInputRef={searchInputRef}
        shouldReduceMotion={shouldReduceMotion}
      />
      <ReaderSearchControl
        Surface={Surface}
        inactiveIconColor={inactiveIconColor}
        isReady={isReady}
        isSearchExpanded={isSearchExpanded}
        onCloseSearch={closeSearch}
        onOpenSearch={() => setIsSearchExpanded(true)}
        shouldReduceMotion={shouldReduceMotion}
      />
    </View>
  );
}

function ReaderPrimarySurface({
  Surface,
  config,
  inactiveIconColor,
  isReady,
  isSearchExpanded,
  searchInputRef,
  shouldReduceMotion,
}: {
  readonly Surface: TabBarSurface;
  readonly config: ReturnType<typeof useReaderTabBar>["config"];
  readonly inactiveIconColor: string;
  readonly isReady: boolean;
  readonly isSearchExpanded: boolean;
  readonly searchInputRef: RefObject<SearchFieldRef | null>;
  readonly shouldReduceMotion: boolean;
}) {
  return (
    <Animated.View
      layout={shouldReduceMotion ? undefined : READER_LAYOUT_TRANSITION}
      className="h-14 min-w-0 flex-1 overflow-hidden rounded-full"
    >
      <Surface style={{ flex: 1, height: "100%", width: "100%" }}>
        <ReaderPrimaryContent
          config={config}
          inactiveIconColor={inactiveIconColor}
          isReady={isReady}
          isSearchExpanded={isSearchExpanded}
          searchInputRef={searchInputRef}
          shouldReduceMotion={shouldReduceMotion}
        />
      </Surface>
    </Animated.View>
  );
}

function ReaderPrimaryContent({
  config,
  inactiveIconColor,
  isReady,
  isSearchExpanded,
  searchInputRef,
  shouldReduceMotion,
}: {
  readonly config: ReturnType<typeof useReaderTabBar>["config"];
  readonly inactiveIconColor: string;
  readonly isReady: boolean;
  readonly isSearchExpanded: boolean;
  readonly searchInputRef: RefObject<SearchFieldRef | null>;
  readonly shouldReduceMotion: boolean;
}) {
  if (isSearchExpanded) {
    return (
      <Animated.View
        entering={shouldReduceMotion ? undefined : READER_CONTENT_ENTERING}
        exiting={shouldReduceMotion ? undefined : READER_CONTENT_EXITING}
        key="reader-search"
        className="size-full flex-1"
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
      entering={shouldReduceMotion ? undefined : READER_CONTENT_ENTERING}
      exiting={shouldReduceMotion ? undefined : READER_CONTENT_EXITING}
      key="reader-actions"
      className="size-full flex-1"
    >
      <View className="flex-1 flex-row items-center">
        <ReaderAction
          accessibilityLabel={config?.isSaved ? "Remove from read later" : "Read later"}
          disabled={config?.isUpdating ?? true}
          onPress={config?.onToggleSaved}
        >
          <BookmarkIcon
            fill={config?.isSaved ? kyomiNativeBrand.mizu.color : inactiveIconColor}
            focused={config?.isSaved}
            size={ACTION_ICON_SIZE}
          />
        </ReaderAction>
        <ReaderAction
          accessibilityLabel="Open source"
          disabled={!isReady}
          onPress={config?.onOpenSource}
        >
          <ExternalLinkIcon fill={inactiveIconColor} size={ACTION_ICON_SIZE} />
        </ReaderAction>
        <ReaderAction
          accessibilityLabel="Share article"
          disabled={!isReady}
          onPress={config?.onShare}
        >
          <ShareIcon fill={inactiveIconColor} size={ACTION_ICON_SIZE} />
        </ReaderAction>
      </View>
    </Animated.View>
  );
}

function ReaderSearchControl({
  Surface,
  inactiveIconColor,
  isReady,
  isSearchExpanded,
  onCloseSearch,
  onOpenSearch,
  shouldReduceMotion,
}: {
  readonly Surface: TabBarSurface;
  readonly inactiveIconColor: string;
  readonly isReady: boolean;
  readonly isSearchExpanded: boolean;
  readonly onCloseSearch: () => void;
  readonly onOpenSearch: () => void;
  readonly shouldReduceMotion: boolean;
}) {
  const label = isSearchExpanded ? "Close article search" : "Find in article";
  const onPress = isSearchExpanded ? onCloseSearch : onOpenSearch;

  return (
    <ReaderSeparateAction
      accessibilityLabel={label}
      disabled={!isSearchExpanded && !isReady}
      onPress={onPress}
      shouldAnimate={!shouldReduceMotion}
      Surface={Surface}
    >
      {isSearchExpanded ? (
        <CloseIcon fill={inactiveIconColor} size={ACTION_ICON_SIZE} />
      ) : (
        <ListSearchIcon fill={inactiveIconColor} size={ACTION_ICON_SIZE} />
      )}
    </ReaderSeparateAction>
  );
}

function ReaderAction({
  accessibilityLabel,
  children,
  disabled,
  onPress,
}: {
  readonly accessibilityLabel: string;
  readonly children: ReactNode;
  readonly disabled: boolean;
  readonly onPress: (() => void) | undefined;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className="m-1 h-12 min-w-0 grow basis-0 items-center justify-center rounded-full active:bg-[rgba(255,255,255,0.12)]"
    >
      {children}
    </Pressable>
  );
}

function ReaderSeparateAction({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
  shouldAnimate,
  Surface,
}: {
  readonly accessibilityLabel: string;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onPress: () => void;
  readonly shouldAnimate: boolean;
  readonly Surface: TabBarSurface;
}) {
  return (
    <Animated.View
      layout={shouldAnimate ? READER_LAYOUT_TRANSITION : undefined}
      className="h-14 w-18 overflow-hidden rounded-full"
    >
      <Surface style={{ height: "100%", width: "100%" }}>
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onPress}
          className="size-full items-center justify-center rounded-full active:bg-[rgba(255,255,255,0.12)]"
        >
          {children}
        </Pressable>
      </Surface>
    </Animated.View>
  );
}
