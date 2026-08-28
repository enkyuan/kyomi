import {
  LiquidGlassContainerView,
  LiquidGlassView,
  isLiquidGlassSupported,
} from "@callstack/liquid-glass";
import { useEffect, useState, type ReactNode } from "react";
import { MenuView, type MenuAction } from "@expo/ui/community/menu";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InboxIcon, MingcuteIcon, SwitcherIcon } from "@/components/icons";
import { FONT_STYLES } from "@/theme/fonts";
import { Album2FillNativeIcon, Album2LineNativeIcon } from "@kyomi/ui/icons/mingcute-native";
import { TAB_BAR_BOTTOM_PADDING } from "./lib/constants";
import type { TabBarProps } from "./lib/types";

const HORIZONTAL_PADDING = 16;
const GAP = 10;
const NORMAL_MAIN_WIDTH = 168;
const COMPACT_MAIN_WIDTH = 150;
const NORMAL_HEIGHT = 48;
const COMPACT_HEIGHT = 44;
const CONTENT_PADDING = 4;
const SELECTOR_RATIO = 0.6;
const SELECTION_INSET = 3;
const FALLBACK_SURFACE_LIGHT = "rgba(245,245,247,0.88)";
const FALLBACK_SURFACE_DARK = "rgba(36,36,36,0.96)";
const SELECTION_PLATTER_LIGHT = "rgba(255,255,255,0.42)";
const SELECTION_PLATTER_DARK = "rgba(0,0,0,0.32)";
const SELECTION_HIGHLIGHT_LIGHT = "rgba(255,255,255,0.12)";
const SELECTION_HIGHLIGHT_DARK = "rgba(255,255,255,0.08)";

export function TabBar({
  minimized = false,
  navigation,
  onSearchQueryChange,
  onSearchSubmit,
  onSelectSource,
  onTabChange,
  selectedSourceId,
  sources = [],
  state,
}: TabBarProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const bottomPadding = Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING);
  const [activeTab, setActiveTab] = useState(state?.index === 1 ? 1 : 0);
  const [searchActive, setSearchActive] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setActiveTab(state?.index === 1 ? 1 : 0);
  }, [state?.index]);

  function selectTab(index: number) {
    if (index > 1) return;
    setActiveTab(index);
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
      setQuery("");
      onSearchQueryChange?.("");
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  const isDark = colorScheme === "dark";
  const effectiveMinimized = searchActive ? false : minimized;
  const height = effectiveMinimized ? COMPACT_HEIGHT : NORMAL_HEIGHT;
  const actionSize = height;
  const availableWidth = Math.max(0, screenWidth - HORIZONTAL_PADDING * 2);
  const maximumMainWidth = Math.max(0, availableWidth - GAP - actionSize);
  const preferredMainWidth = effectiveMinimized ? COMPACT_MAIN_WIDTH : NORMAL_MAIN_WIDTH;
  const mainWidth = Math.min(preferredMainWidth, maximumMainWidth);
  const scale = height / NORMAL_HEIGHT;
  const tabIconSize = 25 * scale;
  const selectorIconSize = 20 * scale;
  const searchIconSize = 18 * scale;
  const closeIconSize = 16 * scale;
  const regularWidth = (mainWidth - CONTENT_PADDING * 2) / (2 + SELECTOR_RATIO);
  const selectorWidth = regularWidth * SELECTOR_RATIO;
  const selectionWidth = Math.max(0, regularWidth + 2 * (CONTENT_PADDING - SELECTION_INSET));
  const selectionX = CONTENT_PADDING + regularWidth * (activeTab + 0.5) - selectionWidth / 2;
  const glassFallback = isLiquidGlassSupported
    ? undefined
    : isDark
      ? FALLBACK_SURFACE_DARK
      : FALLBACK_SURFACE_LIGHT;
  const selectionPlatterFill = isDark ? SELECTION_PLATTER_DARK : SELECTION_PLATTER_LIGHT;
  const selectionPlatterHighlight = isDark ? SELECTION_HIGHLIGHT_DARK : SELECTION_HIGHLIGHT_LIGHT;
  const iconColor = isDark ? "rgba(255,255,255,0.72)" : "rgba(0,0,0,0.72)";
  const searchIconColor = isDark ? "#98989d" : "#8e8e93";
  const searchTextColor = isDark ? "#f5f5f7" : "#1c1c1e";

  return (
    <View pointerEvents="box-none" style={[styles.container, { paddingBottom: bottomPadding }]}>
      {searchActive ? (
        <LiquidGlassView
          effect="regular"
          interactive
          style={[
            styles.searchField,
            { backgroundColor: glassFallback, borderRadius: height / 2, height },
          ]}
        >
          <SymbolView name="magnifyingglass" size={searchIconSize} tintColor={searchIconColor} />
          <TextInput
            accessibilityLabel="Search feeds or articles"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onChangeText={(value) => {
              setQuery(value);
              onSearchQueryChange?.(value);
            }}
            onSubmitEditing={() => onSearchSubmit?.(query)}
            placeholder="Search feeds or articles"
            placeholderTextColor={searchIconColor}
            returnKeyType="search"
            style={[styles.searchInput, { color: searchTextColor }]}
            value={query}
          />
        </LiquidGlassView>
      ) : (
        <LiquidGlassContainerView spacing={0} style={{ height, width: mainWidth }}>
          <LiquidGlassView
            effect="regular"
            interactive
            style={[styles.glass, { backgroundColor: glassFallback, borderRadius: height / 2 }]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.selection,
              {
                backgroundColor: selectionPlatterFill,
                borderColor: selectionPlatterHighlight,
                borderRadius: (height - SELECTION_INSET * 2) / 2,
                borderWidth: 0.5,
                height: height - SELECTION_INSET * 2,
                left: selectionX,
                top: SELECTION_INSET,
                width: selectionWidth,
              },
            ]}
          />
          <View style={[styles.navigationContents, { height, paddingHorizontal: CONTENT_PADDING }]}>
            <TabButton
              active={activeTab === 0}
              label="Feeds"
              onPress={() => selectTab(0)}
              width={regularWidth}
            >
              <InboxIcon
                fill={activeTab === 0 ? "#a8d480" : iconColor}
                focused={activeTab === 0}
                size={tabIconSize}
              />
            </TabButton>
            <TabButton
              active={activeTab === 1}
              label="Explore articles"
              onPress={() => selectTab(1)}
              width={regularWidth}
            >
              <MingcuteIcon
                fill={activeTab === 1 ? "#a8d480" : iconColor}
                icon={activeTab === 1 ? Album2FillNativeIcon : Album2LineNativeIcon}
                size={tabIconSize}
              />
            </TabButton>
            <MenuView
              actions={makeSourceActions(sources, selectedSourceId)}
              onPressAction={({ nativeEvent }) => {
                const source = sources.find((item) => item.id === nativeEvent.event);
                if (!source) return;
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
                onSelectSource?.({ id: source.id, kind: source.kind });
              }}
              style={[styles.sourceMenu, { width: selectorWidth }]}
            >
              <View
                accessibilityHint="Opens folders and feeds"
                accessibilityLabel="Choose source"
                accessibilityRole="button"
                style={styles.sourceButton}
              >
                <SwitcherIcon fill={iconColor} size={selectorIconSize} />
              </View>
            </MenuView>
          </View>
        </LiquidGlassContainerView>
      )}
      <Pressable
        accessibilityHint={searchActive ? "Closes search" : "Opens search"}
        accessibilityLabel={searchActive ? "Close search" : "Search"}
        accessibilityRole="button"
        onPress={toggleSearch}
        style={[
          styles.searchButton,
          {
            backgroundColor: glassFallback,
            borderRadius: height / 2,
            height: actionSize,
            width: actionSize,
          },
        ]}
      >
        <LiquidGlassView
          effect="regular"
          interactive
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: glassFallback, borderRadius: height / 2 },
          ]}
        />
        <SymbolView
          name={searchActive ? "xmark" : "magnifyingglass"}
          size={searchActive ? closeIconSize : searchIconSize}
          tintColor={isDark ? "rgba(255,255,255,0.82)" : "rgba(0,0,0,0.82)"}
          weight="regular"
        />
      </Pressable>
    </View>
  );
}

function makeSourceActions(
  sources: TabBarProps["sources"],
  selectedSourceId: string | undefined,
): MenuAction[] {
  const availableSources = sources ?? [];
  if (availableSources.length === 0) {
    return [{ attributes: { disabled: true }, id: "no-sources", title: "No sources available" }];
  }

  const folders = availableSources.filter((source) => source.kind === "folder");
  const feeds = availableSources.filter((source) => source.kind === "feed");
  return [
    ...(folders.length > 0
      ? [
          {
            displayInline: true,
            subactions: folders.map((source) => toSourceAction(source, selectedSourceId)),
            title: "Folders",
          },
        ]
      : []),
    ...(feeds.length > 0
      ? [
          {
            displayInline: true,
            subactions: feeds.map((source) => toSourceAction(source, selectedSourceId)),
            title: "Feeds",
          },
        ]
      : []),
  ];
}

function toSourceAction(
  source: NonNullable<TabBarProps["sources"]>[number],
  selectedSourceId: string | undefined,
): MenuAction {
  return {
    id: source.id,
    image: source.kind === "folder" ? "folder" : "dot.radiowaves.left.and.right",
    state: source.id === selectedSourceId ? "on" : "off",
    title: source.title,
  };
}

function TabButton({
  active,
  children,
  label,
  onPress,
  width,
}: {
  active: boolean;
  children: ReactNode;
  label: string;
  onPress: () => void;
  width: number;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, { width }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-end",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    left: 0,
    paddingHorizontal: HORIZONTAL_PADDING,
    position: "absolute",
    right: 0,
    zIndex: 50,
  },
  glass: { ...StyleSheet.absoluteFill },
  selection: { position: "absolute" },
  navigationContents: {
    alignItems: "center",
    flexDirection: "row",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  tabButton: { alignItems: "center", height: 44, justifyContent: "center" },
  sourceMenu: { height: 44 },
  sourceButton: { alignItems: "center", flex: 1, justifyContent: "center" },
  searchField: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
  },
  searchInput: { ...FONT_STYLES.input, color: "#1c1c1e", flex: 1 },
  searchButton: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});

export default TabBar;
export type { TabBarProps };
