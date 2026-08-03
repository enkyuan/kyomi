import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { Pressable, TextInput, View } from "react-native";
import Animated, { LinearTransition, useReducedMotion } from "react-native-reanimated";
import {
  BackIcon,
  BookmarkIcon,
  CloseIcon,
  ExternalLinkIcon,
  SearchIcon,
  ShareIcon,
} from "@/components/icons";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import { useReaderTabBar } from "../reader-mode";
import { styles } from "../lib/styles";
import type { TabBarSurface } from "../lib/types";

const ACTION_ICON_SIZE = 19;
const FOREGROUND_COLOR = "#f4f4f5";
const INACTIVE_COLOR = "#a1a1aa";
const READER_LAYOUT_TRANSITION = LinearTransition.duration(220);

export function ReaderTabBarContent({ Surface }: { readonly Surface: TabBarSurface }) {
  const router = useRouter();
  const { config } = useReaderTabBar();
  const searchInputRef = useRef<TextInput>(null);
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
    <View accessibilityRole="toolbar" pointerEvents="box-none" style={styles.readerRow}>
      <ReaderSeparateAction
        accessibilityLabel="Back to inbox"
        onPress={goBack}
        shouldAnimate={!shouldReduceMotion}
        Surface={Surface}
      >
        <BackIcon fill={FOREGROUND_COLOR} size={ACTION_ICON_SIZE} />
      </ReaderSeparateAction>
      <Animated.View
        layout={shouldReduceMotion ? undefined : READER_LAYOUT_TRANSITION}
        style={styles.readerWrapper}
      >
        <Surface style={styles.readerSurface}>
          {isSearchExpanded ? (
            <View style={styles.readerSearchField}>
              <SearchIcon fill={INACTIVE_COLOR} size={16} />
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
              <Pressable
                accessibilityLabel="Close article search"
                accessibilityRole="button"
                onPress={closeSearch}
                style={styles.readerSearchCloseAction}
              >
                <CloseIcon fill={INACTIVE_COLOR} size={18} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.readerBar}>
              <ReaderAction
                accessibilityLabel={config?.isSaved ? "Remove from read later" : "Read later"}
                disabled={!isReady || config.isUpdating}
                onPress={config?.onToggleSaved}
              >
                <BookmarkIcon
                  fill={config?.isSaved ? kyomiNativeBrand.mizu.color : INACTIVE_COLOR}
                  focused={config?.isSaved}
                  size={ACTION_ICON_SIZE}
                />
              </ReaderAction>
              <ReaderAction
                accessibilityLabel="Open source"
                disabled={!isReady}
                onPress={config?.onOpenSource}
              >
                <ExternalLinkIcon fill={INACTIVE_COLOR} size={ACTION_ICON_SIZE} />
              </ReaderAction>
              <ReaderAction
                accessibilityLabel="Share article"
                disabled={!isReady}
                onPress={config?.onShare}
              >
                <ShareIcon fill={INACTIVE_COLOR} size={ACTION_ICON_SIZE} />
              </ReaderAction>
            </View>
          )}
        </Surface>
      </Animated.View>
      {isSearchExpanded ? null : (
        <ReaderSeparateAction
          accessibilityLabel="Find in article"
          disabled={!isReady}
          onPress={() => setIsSearchExpanded(true)}
          shouldAnimate={!shouldReduceMotion}
          Surface={Surface}
        >
          <SearchIcon fill={INACTIVE_COLOR} size={ACTION_ICON_SIZE} />
        </ReaderSeparateAction>
      )}
    </View>
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
      style={({ pressed }) => [styles.readerAction, pressed && styles.readerActionPressed]}
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
      style={styles.readerSeparateWrapper}
    >
      <Surface style={styles.readerSeparateSurface}>
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onPress}
          style={({ pressed }) => [
            styles.readerSeparateAction,
            pressed && styles.readerActionPressed,
          ]}
        >
          {children}
        </Pressable>
      </Surface>
    </Animated.View>
  );
}
