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

const COMPACT_TITLE_FONT_SIZE = 12.5;
const DEFAULT_TITLE_FONT_SIZE = 16;

function InboxEmptyState() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width <= 360;
  const titleFontSize = isCompact ? COMPACT_TITLE_FONT_SIZE : DEFAULT_TITLE_FONT_SIZE;

  return (
    <View
      className="flex-1 items-center justify-center gap-5 px-5.5"
      style={{ paddingBottom: getTabBarOcclusionHeight(insets) }}
    >
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
          No articles yet
        </Text>
        <Text className="w-full self-center max-w-88 text-center text-[13px] leading-5 text-muted-foreground">
          New stories will show up here after feeds publish or refresh.
        </Text>
      </View>
    </View>
  );
}

export function InboxScreen() {
  const colorScheme = useColorScheme();
  const theme = getMobileSurfaceTheme(colorScheme);
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const topContentInset = insets.top + COMPACT_NAV_HEIGHT + 14;

  const headerActions = (
    <>
      <HeaderActionButton
        icon={<FilterIcon fill={theme.foreground} size={18} />}
        label="Sources and filters"
        onPress={() => router.push("/(protected)/(tabs)/switcher")}
      />
      <HeaderActionButton
        icon={<SettingsIcon fill={theme.foreground} size={18} />}
        label="Settings"
        onPress={() => router.push("/(protected)/(tabs)/settings")}
      />
    </>
  );

  return (
    <View style={{ backgroundColor: theme.background, flex: 1 }}>
      <List
        ListEmptyComponent={<InboxEmptyState />}
        scrollY={scrollY}
        topContentInset={topContentInset}
      />
      <CollapsingHeader actions={headerActions} scrollY={scrollY} title="Inbox" />
    </View>
  );
}
