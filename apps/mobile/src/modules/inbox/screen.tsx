import { router } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Text as ReactNativeText,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { Host } from "@expo/ui";
import { MenuView } from "@expo/ui/community/menu";
import { FilterIcon } from "@/components/icons/filter";
import { SettingsIcon } from "@/components/icons/settings";
import { CollapsingHeader, HeaderActionButton, COMPACT_NAV_HEIGHT } from "@ui/header";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { FONT_STYLES } from "@/theme/fonts";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import type { InboxFilter } from "./model";
import { List } from "@modules/inbox/components/list";
import { type ArticleScope } from "@modules/inbox/hooks/use-articles";
import { useSubscribedFeeds } from "@modules/inbox/hooks/use-subscribed-feeds";

const COMPACT_TITLE_FONT_SIZE = 12.5;
const DEFAULT_TITLE_FONT_SIZE = 16;
const EMPTY_HORIZONTAL_INSET_RATIO = 22 / 390;
type InboxEmptyStateProps = {
  filter: InboxFilter;
  hasNoFeeds: boolean;
  height: number;
  topContentInset: number;
};

function InboxEmptyState({ filter, hasNoFeeds, height, topContentInset }: InboxEmptyStateProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = getMobileSurfaceTheme(useColorScheme());
  const isCompact = width <= 360;
  const titleFontSize = isCompact ? COMPACT_TITLE_FONT_SIZE : DEFAULT_TITLE_FONT_SIZE;
  const emptyHorizontalInset = width * EMPTY_HORIZONTAL_INSET_RATIO;
  const emptyContentWidth = Math.max(0, width - emptyHorizontalInset * 2);
  const availableHeight = Math.max(0, height - topContentInset - getTabBarOcclusionHeight(insets));

  return (
    <View
      className="items-center justify-center gap-5"
      style={{ height: availableHeight, paddingHorizontal: emptyHorizontalInset }}
    >
      <EmptyStateIcon size={176} />
      <View className="items-center gap-2" style={{ width: emptyContentWidth }}>
        <ReactNativeText
          numberOfLines={1}
          style={{
            ...FONT_STYLES.sectionTitle,
            color: theme.foreground,
            fontSize: titleFontSize,
            lineHeight: Math.round(titleFontSize * 1.35),
            textAlign: "center",
          }}
        >
          {hasNoFeeds
            ? "No feeds yet"
            : filter === "saved"
              ? "No saved articles yet"
              : filter === "unread"
                ? "No unread articles"
                : "No articles yet"}
        </ReactNativeText>
        <ReactNativeText
          style={{
            ...FONT_STYLES.bodySmall,
            color: theme.mutedForeground,
            textAlign: "center",
          }}
        >
          {hasNoFeeds
            ? "Follow a feed to see its latest\nstories here."
            : "New stories will show up here after\nfeeds publish or refresh."}
        </ReactNativeText>
      </View>
    </View>
  );
}

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

  const headerActions = (
    <>
      {Platform.OS === "ios" ? (
        (() => {
          const { Button, Image, Menu } = require("@expo/ui/swift-ui");
          const {
            accessibilityLabel,
            frame,
            glassEffect,
            menuIndicator,
            tint,
          } = require("@expo/ui/swift-ui/modifiers");

          return (
            <Host style={{ height: 38, width: 38 }}>
              <Menu
                label={
                  <Image
                    systemName="line.3.horizontal.decrease"
                    size={18}
                    modifiers={[
                      frame({ height: 38, width: 38 }),
                      glassEffect({
                        glass: { interactive: true, variant: "regular" },
                        shape: "circle",
                      }),
                      accessibilityLabel("Sources and filters"),
                    ]}
                  />
                }
                modifiers={[menuIndicator("hidden"), tint(theme.foreground)]}
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
          );
        })()
      ) : (
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
      )}
      <HeaderActionButton
        icon={<SettingsIcon fill={theme.foreground} size={18} />}
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
          <InboxEmptyState
            filter={filter}
            hasNoFeeds={hasNoSubscribedFeeds}
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
