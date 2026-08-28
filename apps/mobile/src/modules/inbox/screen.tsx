import { router } from "expo-router";
import { Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { EmptyStateIcon } from "@/components/icons/empty-state";
import { FilterIcon } from "@/components/icons/filter";
import { SettingsIcon } from "@/components/icons/settings";
import { CollapsingHeader, HeaderActionButton, COMPACT_NAV_HEIGHT } from "@ui/header";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import { List } from "@modules/inbox/components/list";
import { type ArticleScope } from "@modules/inbox/hooks/use-articles";
import { useSubscribedFeeds } from "@modules/inbox/hooks/use-subscribed-feeds";

const COMPACT_TITLE_FONT_SIZE = 12.5;
const DEFAULT_TITLE_FONT_SIZE = 16;

type InboxEmptyStateProps = {
  hasNoFeeds: boolean;
  height: number;
  topContentInset: number;
};

function InboxEmptyState({ hasNoFeeds, height, topContentInset }: InboxEmptyStateProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width <= 360;
  const titleFontSize = isCompact ? COMPACT_TITLE_FONT_SIZE : DEFAULT_TITLE_FONT_SIZE;
  const availableHeight = Math.max(0, height - topContentInset - getTabBarOcclusionHeight(insets));

  return (
    <View className="items-center justify-center gap-5 px-5.5" style={{ height: availableHeight }}>
      <EmptyStateIcon size={176} />
      <View className="w-full max-w-136 gap-2">
        <Text
          adjustsFontSizeToFit
          allowFontScaling={false}
          className="w-full self-center text-center font-semibold text-foreground"
          minimumFontScale={0.8}
          numberOfLines={1}
          style={{ fontSize: titleFontSize, lineHeight: Math.round(titleFontSize * 1.35) }}
        >
          {hasNoFeeds ? "No feeds yet" : "No articles yet"}
        </Text>
        <Text className="w-full self-center max-w-88 text-center text-[13px] leading-5 text-muted-foreground">
          {hasNoFeeds
            ? "Follow a feed to see its latest stories here."
            : "New stories will show up here after feeds publish or refresh."}
        </Text>
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

  const headerActions = (
    <>
      <HeaderActionButton
        icon={<FilterIcon fill={theme.foreground} size={18} />}
        label="Sources and filters"
        onPress={() => router.push("/(protected)/switcher")}
      />
      <HeaderActionButton
        icon={<SettingsIcon fill={theme.foreground} size={18} />}
        label="Settings"
        onPress={() => router.push("/(protected)/settings")}
      />
    </>
  );

  return (
    <View style={{ backgroundColor: theme.background, flex: 1 }}>
      <List
        ListEmptyComponent={
          <InboxEmptyState
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
