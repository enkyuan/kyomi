import { router } from "expo-router";
import { useState } from "react";
import { Platform, useColorScheme, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { Host } from "@expo/ui";
import { SymbolView } from "expo-symbols";
import { MenuView } from "@expo/ui/community/menu";
import { FilterIcon } from "@/components/icons/filter";
import { CollapsingHeader, HeaderActionButton, COMPACT_NAV_HEIGHT } from "@ui/header";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import type { InboxFilter } from "./lib/model";
import { EmptyState } from "@modules/inbox/components/empty-state";
import { List } from "@modules/inbox/components/list";
import { type ArticleScope } from "@modules/inbox/hooks/use-articles";
import { useSubscribedFeeds } from "@modules/inbox/hooks/use-subscribed-feeds";

type InboxScreenProps = {
  scope?: ArticleScope;
  title?: string;
};

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

  const headerActions =
    Platform.OS === "ios" ? (
      (() => {
        const { Button, Image, Menu } = require("@expo/ui/swift-ui");
        const {
          accessibilityLabel,
          buttonStyle,
          frame,
          glassEffect,
          menuIndicator,
          menuStyle,
          tint,
        } = require("@expo/ui/swift-ui/modifiers");
        const actionModifiers = [
          frame({ height: 38, width: 38 }),
          glassEffect({
            glass: { interactive: true, variant: "regular" },
            shape: "circle",
          }),
        ];

        return (
          <>
            <Host style={{ height: 38, width: 38 }}>
              <Menu
                label={
                  <Image
                    systemName="line.3.horizontal.decrease"
                    size={18}
                    modifiers={[...actionModifiers, accessibilityLabel("Sources and filters")]}
                  />
                }
                modifiers={[
                  menuStyle("button"),
                  buttonStyle("plain"),
                  menuIndicator("hidden"),
                  tint(theme.foreground),
                ]}
              >
                <Button
                  label="All"
                  onPress={() => setFilter("all")}
                  systemImage={filter === "all" ? "checkmark" : "square.grid.2x2"}
                />
                <Button
                  label="Unread"
                  onPress={() => setFilter("unread")}
                  systemImage={filter === "unread" ? "checkmark" : "circle"}
                />
                <Button
                  label="Saved"
                  onPress={() => setFilter("saved")}
                  systemImage={filter === "saved" ? "checkmark" : "bookmark"}
                />
              </Menu>
            </Host>
            <Host style={{ height: 38, width: 38 }}>
              <Image
                onPress={() => router.push("/(protected)/settings")}
                systemName="gearshape"
                size={18}
                modifiers={[
                  ...actionModifiers,
                  accessibilityLabel("Settings"),
                  tint(theme.foreground),
                ]}
              />
            </Host>
          </>
        );
      })()
    ) : (
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
              setFilter(nextFilter);
            }
          }}
          style={{ height: 38, width: 38 }}
        >
          <HeaderActionButton
            icon={<FilterIcon fill={theme.foreground} size={18} />}
            label="Filters"
          />
        </MenuView>
        <HeaderActionButton
          icon={
            <SymbolView
              accessibilityElementsHidden
              name={{ android: "settings", ios: "gearshape", web: "settings" }}
              size={18}
              tintColor={theme.foreground}
              weight="regular"
            />
          }
          label="Settings"
          onPress={() => router.push("/(protected)/settings")}
        />
      </>
    );

  return (
    <View className="flex-1 bg-background">
      <List
        filter={filter}
        ListEmptyComponent={
          <EmptyState
            asset={<EmptyStateIcon size={176} />}
            description={
              hasNoSubscribedFeeds
                ? "Follow a feed to see its latest\nstories here."
                : "New stories will show up here after\nfeeds publish or refresh."
            }
            header={
              hasNoSubscribedFeeds
                ? "No feeds yet"
                : filter === "saved"
                  ? "No saved articles yet"
                  : filter === "unread"
                    ? "No unread articles"
                    : "No articles yet"
            }
            height={height}
            topContentInset={topContentInset}
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
