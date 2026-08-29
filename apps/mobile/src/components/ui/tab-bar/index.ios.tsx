import { useEffect, useRef, useState, type ReactElement } from "react";
import { useColorScheme, useWindowDimensions } from "react-native";
import { mobileColors } from "@/theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { InboxIcon, MingcuteIcon, SwitcherIcon } from "@/components/icons";
import { Album2FillNativeIcon, Album2LineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import {
  Button,
  GlassEffectContainer,
  HStack,
  Host,
  Menu,
  RNHostView,
  Section,
  Spacer,
  TextField,
  ZStack,
  useNativeState,
  type TextFieldRef,
} from "@expo/ui/swift-ui";
import {
  accessibilityHidden,
  accessibilityLabel,
  accessibilityValue,
  animation,
  backgroundOverlay,
  Animation,
  buttonStyle,
  clipShape,
  disabled,
  foregroundStyle,
  frame,
  glassEffect,
  menuIndicator,
  menuStyle,
  offset,
  opacity,
  padding,
  strokeBorder,
} from "@expo/ui/swift-ui/modifiers";
import { SELECTOR_RATIO, TAB_BAR_BOTTOM_PADDING } from "./lib/constants";
import type { TabBarProps } from "./lib/types";

const HORIZONTAL_PADDING = 16;
const GAP = 10;
const NORMAL_MAIN_WIDTH = 168;
const COMPACT_MAIN_WIDTH = 150;
const NORMAL_HEIGHT = 48;
const COMPACT_HEIGHT = 44;
const CONTENT_PADDING = 4;
const SELECTION_INSET = 3;
const SELECTION_PLATTER_LIGHT = "rgba(255,255,255,0.42)";
const SELECTION_PLATTER_DARK = "rgba(0,0,0,0.32)";
const SELECTION_HIGHLIGHT_LIGHT = "rgba(255,255,255,0.12)";
const SELECTION_HIGHLIGHT_DARK = "rgba(255,255,255,0.08)";

const GLASS = glassEffect({
  glass: { interactive: true, variant: "regular" },
  shape: "capsule",
});
const SPRING = Animation.spring({ duration: 0.45, bounce: 0.08 });

export function TabBar({
  minimized = false,
  navigation,
  onSearchQueryChange,
  onSelectSource,
  onTabChange,
  selectedSourceId,
  sources = [],
  state,
}: TabBarProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const [fallbackActiveTab, setFallbackActiveTab] = useState(state?.index === 1 ? 1 : 0);
  const [searchActive, setSearchActive] = useState(false);
  const searchText = useNativeState("");
  const searchFieldRef = useRef<TextFieldRef>(null);
  const activeTab = state ? (state.index === 1 ? 1 : 0) : fallbackActiveTab;
  const isDark = colorScheme === "dark";
  const bottomPadding = Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING);
  const effectiveMinimized = searchActive ? false : minimized;
  const height = effectiveMinimized ? COMPACT_HEIGHT : NORMAL_HEIGHT;
  const availableWidth = Math.max(0, screenWidth - HORIZONTAL_PADDING * 2);
  const actionSize = height;
  const maximumMainWidth = Math.max(0, availableWidth - GAP - actionSize);
  const preferredMainWidth = effectiveMinimized ? COMPACT_MAIN_WIDTH : NORMAL_MAIN_WIDTH;
  const mainWidth = Math.min(preferredMainWidth, maximumMainWidth);
  const searchWidth = Math.max(0, availableWidth - GAP - actionSize);
  const scale = height / NORMAL_HEIGHT;
  const tabIconSize = 25 * scale;
  const selectorIconSize = 20 * scale;
  const searchIconSize = 18 * scale;
  const regularWidth = (mainWidth - CONTENT_PADDING * 2) / (2 + SELECTOR_RATIO);
  const selectorWidth = regularWidth * SELECTOR_RATIO;
  const selectionWidth = Math.max(0, regularWidth + 2 * (CONTENT_PADDING - SELECTION_INSET));
  const selectionX = CONTENT_PADDING + regularWidth * (activeTab + 0.5) - selectionWidth / 2;
  const selectionOffset = selectionX + selectionWidth / 2 - mainWidth / 2;
  const iconColor = isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.72)";
  const activeIconColor = mobileColors.matcha;
  const searchIconColor = isDark ? "#98989d" : "#8e8e93";
  const searchTextColor = isDark ? "#f5f5f7" : "#1c1c1e";
  const selectionPlatterFill = isDark ? SELECTION_PLATTER_DARK : SELECTION_PLATTER_LIGHT;
  const selectionPlatterHighlight = isDark ? SELECTION_HIGHLIGHT_DARK : SELECTION_HIGHLIGHT_LIGHT;

  useEffect(() => {
    if (searchActive) {
      void searchFieldRef.current?.focus();
    } else {
      void searchFieldRef.current?.blur();
    }
  }, [searchActive]);

  function selectTab(index: number) {
    if (index > 1) return;
    setFallbackActiveTab(index);
    onTabChange?.(index);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

    if (!state || !navigation) return;
    const route = state.routes[index];
    if (!route) return;
    const event = navigation.emit({ canPreventDefault: true, target: route.key, type: "tabPress" });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  }

  function toggleSearch() {
    const next = !searchActive;
    setSearchActive(next);
    if (!next) {
      searchText.set("");
      onSearchQueryChange?.("");
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  return (
    <Host
      colorScheme={isDark ? "dark" : "light"}
      matchContents={{ vertical: true }}
      pointerEvents="box-none"
      style={{
        bottom: bottomPadding,
        width: "100%",
        left: 0,
        paddingHorizontal: HORIZONTAL_PADDING,
        position: "absolute",
        right: 0,
        zIndex: 50,
      }}
    >
      <HStack
        alignment="center"
        modifiers={[
          frame({ height, width: availableWidth }),
          animation(SPRING, minimized),
          animation(SPRING, searchActive),
        ]}
        spacing={0}
      >
        <Spacer />
        <HStack modifiers={[animation(SPRING, searchActive)]} spacing={GAP}>
          <GlassEffectContainer spacing={0}>
            <ZStack
              alignment="center"
              modifiers={[
                frame({ height, width: searchActive ? searchWidth : mainWidth }),
                GLASS,
                animation(SPRING, minimized),
                animation(SPRING, searchActive),
              ]}
            >
              <ZStack
                modifiers={[
                  frame({
                    height: height - SELECTION_INSET * 2,
                    width: selectionWidth,
                  }),
                  backgroundOverlay({ color: selectionPlatterFill }),
                  strokeBorder({ color: selectionPlatterHighlight, style: { lineWidth: 0.5 } }),
                  clipShape("capsule"),
                  offset({ x: selectionOffset }),
                  opacity(searchActive ? 0 : 1),
                  animation(SPRING, minimized),
                  animation(SPRING, activeTab),
                ]}
              >
                {null}
              </ZStack>
              <HStack
                alignment="center"
                modifiers={[
                  frame({ height, width: mainWidth }),
                  padding({ horizontal: CONTENT_PADDING }),
                  opacity(searchActive ? 0 : 1),
                  accessibilityHidden(searchActive),
                  animation(SPRING, searchActive),
                ]}
                spacing={0}
              >
                <TabButton
                  active={activeTab === 0}
                  height={height}
                  label="Feeds"
                  onPress={() => selectTab(0)}
                  width={regularWidth}
                >
                  <InboxIcon
                    fill={activeTab === 0 ? activeIconColor : iconColor}
                    focused={activeTab === 0}
                    size={tabIconSize}
                  />
                </TabButton>
                <TabButton
                  active={activeTab === 1}
                  height={height}
                  label="Explore articles"
                  onPress={() => selectTab(1)}
                  width={regularWidth}
                >
                  <MingcuteIcon
                    fill={activeTab === 1 ? activeIconColor : iconColor}
                    icon={activeTab === 1 ? Album2FillNativeIcon : Album2LineNativeIcon}
                    size={tabIconSize}
                  />
                </TabButton>
                <Menu
                  label={
                    <RNHostView matchContents>
                      <SwitcherIcon fill={iconColor} size={selectorIconSize} />
                    </RNHostView>
                  }
                  modifiers={[
                    frame({ height, width: selectorWidth }),
                    buttonStyle("plain"),
                    menuStyle("button"),
                    menuIndicator("hidden"),
                    accessibilityLabel("Choose source"),
                    accessibilityValue("Opens folders and feeds"),
                  ]}
                >
                  {renderSourceMenuItems(sources, selectedSourceId, onSelectSource)}
                </Menu>
              </HStack>
              <HStack
                alignment="center"
                modifiers={[
                  padding({ horizontal: 14 }),
                  frame({ height, width: searchWidth }),
                  opacity(searchActive ? 1 : 0),
                  accessibilityHidden(!searchActive),
                  animation(SPRING, searchActive),
                ]}
                spacing={8}
              >
                <ZStack alignment="center" modifiers={[frame({ height, width: 22 })]}>
                  <RNHostView matchContents>
                    <SymbolView name="magnifyingglass" size={18} tintColor={searchIconColor} />
                  </RNHostView>
                </ZStack>
                <TextField
                  autoFocus={false}
                  onTextChange={(value) => {
                    onSearchQueryChange?.(value);
                  }}
                  placeholder="Search feeds or articles"
                  text={searchText}
                  modifiers={[foregroundStyle(searchTextColor)]}
                />
              </HStack>
            </ZStack>
          </GlassEffectContainer>
          <GlassEffectContainer spacing={0}>
            <Button
              onPress={toggleSearch}
              modifiers={[
                frame({ height: actionSize, width: actionSize }),
                GLASS,
                buttonStyle("plain"),
                accessibilityLabel(searchActive ? "Close search" : "Search"),
              ]}
            >
              <RNHostView matchContents>
                <SymbolView
                  name={searchActive ? "xmark" : "magnifyingglass"}
                  size={searchActive ? 16 * scale : searchIconSize}
                  tintColor={isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.82)"}
                  weight="regular"
                />
              </RNHostView>
            </Button>
          </GlassEffectContainer>
        </HStack>
        <Spacer />
      </HStack>
    </Host>
  );
}

function TabButton({
  active,
  children,
  height,
  label,
  onPress,
  width,
}: {
  active: boolean;
  children: ReactElement;
  height: number;
  label: string;
  onPress: () => void;
  width: number;
}) {
  return (
    <Button
      onPress={onPress}
      modifiers={[
        frame({ height, width }),
        buttonStyle("plain"),
        accessibilityLabel(label),
        accessibilityValue(active ? "Selected" : ""),
      ]}
    >
      <RNHostView matchContents>{children}</RNHostView>
    </Button>
  );
}

type Source = NonNullable<TabBarProps["sources"]>[number];

function renderSourceMenuItems(
  sources: readonly Source[],
  selectedSourceId: string | undefined,
  onSelectSource: TabBarProps["onSelectSource"],
) {
  if (sources.length === 0) {
    return <Button label="No sources available" modifiers={[disabled(true)]} />;
  }

  const folders = sources.filter((source) => source.kind === "folder");
  const feeds = sources.filter((source) => source.kind === "feed");
  return (
    <>
      {folders.length > 0 ? (
        <Section title="Folders">
          {folders.map((source) => (
            <SourceButton
              key={source.id}
              onSelectSource={onSelectSource}
              selected={source.id === selectedSourceId}
              source={source}
            />
          ))}
        </Section>
      ) : null}
      {feeds.length > 0 ? (
        <Section title="Feeds">
          {feeds.map((source) => (
            <SourceButton
              key={source.id}
              onSelectSource={onSelectSource}
              selected={source.id === selectedSourceId}
              source={source}
            />
          ))}
        </Section>
      ) : null}
    </>
  );
}

function SourceButton({
  onSelectSource,
  selected,
  source,
}: {
  onSelectSource: TabBarProps["onSelectSource"];
  selected: boolean;
  source: Source;
}) {
  return (
    <Button
      label={source.title}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onSelectSource?.({ id: source.id, kind: source.kind });
      }}
      systemImage={
        selected
          ? "checkmark"
          : source.kind === "folder"
            ? "folder"
            : "dot.radiowaves.left.and.right"
      }
    />
  );
}
