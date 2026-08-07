import { RNHostView, ZStack } from "@expo/ui/swift-ui";
import {
  Animation,
  accessibilityHidden,
  animation,
  blur,
  disabled,
  frame,
  opacity,
} from "@expo/ui/swift-ui/modifiers";
import { type ReactNode, type RefObject } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { BookmarkIcon, ExternalLinkIcon, ShareIcon } from "@/components/icons";
import { SearchField, type SearchFieldRef } from "@/components/ui/search-field/atoms";
import { kyomiNativeBrand } from "@kyomi/ui/native/theme";
import type { ReaderTabBarConfig } from "../modes/reader";

const ACTION_ICON_SIZE = 19;
const BAR_HEIGHT = 56;
const BAR_ANIMATION = Animation.spring({ duration: 0.22, bounce: 0 });

export function LiquidReaderLayer({
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
        <View pointerEvents={active ? "auto" : "none"} className="size-full flex-1">
          {children}
        </View>
      </RNHostView>
    </ZStack>
  );
}

export function LiquidReaderPrimaryActions({
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
  const entering = shouldReduceMotion ? undefined : FadeIn.delay(36).duration(164);
  const exiting = shouldReduceMotion ? undefined : FadeOut.duration(96);

  if (isSearchExpanded) {
    return (
      <Animated.View
        entering={entering}
        exiting={exiting}
        key="search"
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
    <Animated.View entering={entering} exiting={exiting} key="actions" className="size-full flex-1">
      <View className="flex-1 flex-row items-center">
        <LiquidReaderToolbarAction
          accessibilityLabel={config?.isSaved ? "Remove from read later" : "Read later"}
          disabled={!isReady || config.isUpdating}
          onPress={config?.onToggleSaved}
        >
          <BookmarkIcon
            fill={config?.isSaved ? kyomiNativeBrand.mizu.color : inactiveColor}
            focused={config?.isSaved}
            size={ACTION_ICON_SIZE}
          />
        </LiquidReaderToolbarAction>
        <LiquidReaderToolbarAction
          accessibilityLabel="Open source"
          disabled={!isReady}
          onPress={config?.onOpenSource}
        >
          <ExternalLinkIcon fill={inactiveColor} size={ACTION_ICON_SIZE} />
        </LiquidReaderToolbarAction>
        <LiquidReaderToolbarAction
          accessibilityLabel="Share article"
          disabled={!isReady}
          onPress={config?.onShare}
        >
          <ShareIcon fill={inactiveColor} size={ACTION_ICON_SIZE} />
        </LiquidReaderToolbarAction>
      </View>
    </Animated.View>
  );
}

export function LiquidReaderSeparateAction({
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
      className="size-full items-center justify-center rounded-full active:bg-[rgba(255,255,255,0.12)]"
    >
      {children}
    </Pressable>
  );
}

function LiquidReaderToolbarAction({
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
      className="m-1 h-12 min-w-0 grow basis-0 items-center justify-center rounded-full active:bg-[rgba(255,255,255,0.12)]"
    >
      {children}
    </Pressable>
  );
}
