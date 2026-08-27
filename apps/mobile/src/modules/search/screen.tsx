import { useState } from "react";
import { Alert, FlatList, Pressable, Text, View, useColorScheme } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { FeedFavicon } from "@modules/inbox/components/feed-favicon";
import { getTabBarOcclusionHeight } from "@ui/tab-bar/lib/styles";
import { triggerSelectionHaptic } from "@utils/haptics";
import { getMobileSurfaceTheme } from "@/theme/surfaces";
import {
  type DiscoveredFeed,
  useDiscoveredFeeds,
  useFollowDiscoveredFeed,
} from "./hooks/use-discovered-feeds";

type SearchScreenProps = {
  readonly query?: string;
  readonly onQueryChange?: (query: string) => void;
};

export function SearchScreen({
  query: externalQuery,
  onQueryChange: externalOnQueryChange,
}: SearchScreenProps = {}) {
  const theme = getMobileSurfaceTheme(useColorScheme());
  const insets = useSafeAreaInsets();
  const [internalQuery, setInternalQuery] = useState("");
  const query = externalQuery ?? internalQuery;
  const setQuery = externalOnQueryChange ?? setInternalQuery;
  const { items, isLoading, isSearching } = useDiscoveredFeeds(query);
  const followMutation = useFollowDiscoveredFeed();

  const follow = (item: DiscoveredFeed) => {
    if (item.isSubscribed || followMutation.isPending) {
      return;
    }

    void triggerSelectionHaptic();
    void followMutation.mutateAsync(item).catch(() => {
      Alert.alert("Unable to follow feed", "Please try again.");
    });
  };

  const emptyCopy = query.trim()
    ? isLoading || isSearching
      ? "Searching feeds…"
      : "No feeds found. Try a broader topic or paste a feed URL."
    : "Search by topic or paste a feed URL to follow it.";

  return (
    <SafeAreaView className="flex-1" edges={["top"]} style={{ backgroundColor: theme.background }}>
      <FlatList
        className="flex-1"
        contentContainerClassName="grow px-5 pt-6"
        contentContainerStyle={{ paddingBottom: getTabBarOcclusionHeight(insets) + 16 }}
        data={items}
        keyExtractor={(item) => `${item.id ?? item.url}-${item.url}`}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 pb-20">
            <Text className="text-center text-base leading-6 text-muted-foreground">
              {emptyCopy}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="mb-3 flex-row items-center gap-3 rounded-2xl bg-card px-3 py-3">
            <FeedFavicon
              faviconUrl={item.faviconUrl}
              feedUrl={item.url}
              siteUrl={item.link}
              size={32}
              title={item.title || item.url}
            />
            <View className="min-w-0 flex-1">
              <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
                {item.title || item.url}
              </Text>
              <Text className="mt-0.5 text-sm leading-5 text-muted-foreground" numberOfLines={2}>
                {item.description || item.url}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={
                item.isSubscribed ? "Following" : `Follow ${item.title || item.url}`
              }
              accessibilityRole="button"
              className="rounded-full bg-secondary px-3 py-2 active:opacity-70"
              disabled={item.isSubscribed || followMutation.isPending}
              onPress={() => follow(item)}
            >
              <Text className="text-sm font-semibold text-foreground">
                {item.isSubscribed ? "Following" : "Follow"}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

export const AddScreen = SearchScreen;
