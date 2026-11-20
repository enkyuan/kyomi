import { router } from "expo-router";
import { useState } from "react";
import { Button, Platform, useColorScheme, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { Badge } from "@/components/ui/badge";
import { Host } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import type { IconMenuItem } from "../../../modules/tab-bar";
import { toTabBarIcon } from "@/components/ui/tab-bar/lib/icon";
import {
  BookmarkNativeIcon,
  CircleDashedNativeIcon,
  LayoutAlignBottomNativeIcon,
} from "@kyomi/ui/icons/blode-native";
import { MenuView } from "@expo/ui/community/menu";
import { FilterIcon } from "@/components/icons/filter";
import { CollapsingHeader, HeaderActionButton, COMPACT_NAV_HEIGHT } from "@ui/header";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import type { InboxFilter } from "./model";
import { EmptyStateView, type EmptyStateVariant } from "@modules/inbox/components/empty-states";
import { List } from "@modules/inbox/components/list";
import { type ArticleScope } from "@modules/inbox/hooks/use-articles";
import { useSubscribedFeeds } from "@modules/inbox/hooks/use-feeds";

const FILTER_MENU: readonly (Pick<IconMenuItem, "icon" | "title"> & { id: InboxFilter })[] = [
  { icon: toTabBarIcon(LayoutAlignBottomNativeIcon), id: "all", title: "All" },
  { icon: toTabBarIcon(CircleDashedNativeIcon), id: "unread", title: "Unread" },
  { icon: toTabBarIcon(BookmarkNativeIcon), id: "saved", title: "Saved" },
];

type InboxScreenProps = {
  scope?: ArticleScope;
  title?: string;
};

type HeaderActionsProps = {
  filter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
  foreground: string;
};

function IosHeaderActions({ filter, onFilterChange, foreground }: HeaderActionsProps) {
  // The tab bar module is registered on Apple platforms only, so it is loaded here, not at the top.
  const { IconMenuView } = require("../../../modules/tab-bar");
  const { Image } = require("@expo/ui/swift-ui");
  const { accessibilityLabel, frame, glassEffect, tint } = require("@expo/ui/swift-ui/modifiers");
  const actionModifiers = [
    frame({ height: 38, width: 38 }),
    glassEffect({
      glass: { interactive: true, variant: "regular" },
      shape: "circle",
    }),
  ];

  return (
    <>
      <IconMenuView
        accessibilityLabel="Sources and filters"
        symbol="line.3.horizontal.decrease"
        items={FILTER_MENU.map((item) => ({
          checked: filter === item.id,
          icon: item.icon,
          id: item.id,
          title: item.title,
        }))}
        onSelect={({ nativeEvent }: { nativeEvent: { id: string } }) =>
          onFilterChange(nativeEvent.id as InboxFilter)
        }
        style={{ height: 38, width: 38 }}
        tintColor={foreground}
      />
      <Host style={{ height: 38, width: 38 }}>
        <Image
          onPress={() => router.push("/(protected)/settings")}
          systemName="gearshape"
          size={18}
          modifiers={[...actionModifiers, accessibilityLabel("Settings"), tint(foreground)]}
        />
      </Host>
    </>
  );
}

function AndroidHeaderActions({ filter, onFilterChange, foreground }: HeaderActionsProps) {
  return (
    <>
      <MenuView
        actions={[
          { id: "all", state: filter === "all" ? "on" : "off", title: "All" },
          { id: "unread", state: filter === "unread" ? "on" : "off", title: "Unread" },
          { id: "saved", state: filter === "saved" ? "on" : "off", title: "Saved" },
        ]}
        onPressAction={({ nativeEvent }) => {
          const nextFilter = nativeEvent.event;
          if (nextFilter === "all" || nextFilter === "unread" || nextFilter === "saved") {
            onFilterChange(nextFilter);
          }
        }}
        style={{ height: 38, width: 38 }}
      >
        <HeaderActionButton icon={<FilterIcon color={foreground} size={18} />} label="Filters" />
      </MenuView>
      <HeaderActionButton
        icon={
          <SymbolView
            accessibilityElementsHidden
            name={{ android: "settings", ios: "gearshape", web: "settings" }}
            size={18}
            tintColor={foreground}
            weight="regular"
          />
        }
        label="Settings"
        onPress={() => router.push("/(protected)/settings")}
      />
    </>
  );
}

function emptyVariant(
  hasNoSubscribedFeeds: boolean,
  scope: ArticleScope,
  filter: InboxFilter,
): EmptyStateVariant {
  if (hasNoSubscribedFeeds) return "sources-none";
  if (filter === "saved") return "saved";
  if (filter === "unread") return "unread-caught-up";
  return scope === "explore" ? "all-feeds" : "my-feed";
}

function ExploreHint() {
  return (
    <>
      Add a new feed or check out{" "}
      <Badge size="default" style={{ transform: [{ translateY: 3 }] }} variant="secondary">
        Explore
      </Badge>{" "}
      to get started.
    </>
  );
}

export function InboxScreen({ scope = "subscribed", title }: InboxScreenProps) {
  const colorScheme = useColorScheme();
  const theme = getMobileSurfaceTheme(colorScheme);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const topContentInset = insets.top + COMPACT_NAV_HEIGHT + 14;
  const subscribedFeeds = useSubscribedFeeds(scope === "subscribed");
  const screenTitle = title ?? (scope === "explore" ? "Explore" : "My Feeds");
  const hasNoSubscribedFeeds =
    scope === "subscribed" &&
    !subscribedFeeds.isLoading &&
    !subscribedFeeds.isError &&
    subscribedFeeds.count === 0;
  const [filter, setFilter] = useState<InboxFilter>("all");

  // Keep native menu imports out of the other platform bundle.
  const headerActions =
    Platform.OS === "ios" ? (
      <IosHeaderActions filter={filter} foreground={theme.foreground} onFilterChange={setFilter} />
    ) : (
      <AndroidHeaderActions
        filter={filter}
        foreground={theme.foreground}
        onFilterChange={setFilter}
      />
    );

  return (
    <View className="flex-1 bg-background">
      <List
        filter={filter}
        ListHeaderComponent={
          filter === "saved" ? (
            <Button title="Read offline" onPress={() => router.push("/offline")} />
          ) : null
        }
        ListEmptyComponent={
          <EmptyStateView
            description={hasNoSubscribedFeeds ? <ExploreHint /> : undefined}
            height={height}
            topContentInset={topContentInset}
            variant={emptyVariant(hasNoSubscribedFeeds, scope, filter)}
          />
        }
        scope={scope}
        scrollY={scrollY}
        topContentInset={topContentInset}
      />
      <CollapsingHeader actions={headerActions} scrollY={scrollY} title={screenTitle} />
    </View>
  );
}
