import { Stack } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT_STYLES } from "@/theme/fonts";
import { FeedRow } from "./components/feed-row";
import { useFolderFeeds } from "./hooks/use-folder-feeds";

type FolderScreenProps = {
  readonly folderId: string;
};

/** The feeds filed in one folder, under the native stack header that carries its name. */
export function FolderScreen({ folderId }: FolderScreenProps) {
  const insets = useSafeAreaInsets();
  const { feeds, folder, isLoading, move, otherFolders, unfollow } = useFolderFeeds(folderId);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: folder?.name ?? "Folder" }} />
      <FlatList
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        contentInsetAdjustmentBehavior="automatic"
        data={feeds}
        keyExtractor={(feed) => feed.feedId}
        ListEmptyComponent={
          isLoading ? null : (
            <View className="items-center px-8 pt-24">
              <Text className="text-muted-foreground" style={FONT_STYLES.bodyMedium}>
                No feeds in this folder yet.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <FeedRow
            feed={item}
            onMove={(targetFolderId) => move({ feedId: item.feedId, folderId: targetFolderId })}
            onUnfollow={() => unfollow(item.feedId)}
            otherFolders={otherFolders}
          />
        )}
      />
    </View>
  );
}
