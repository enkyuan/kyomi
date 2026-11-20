import { Stack } from "expo-router";
import { FlatList, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyStateView } from "@modules/inbox/components/empty-states";
import { Skeleton } from "@ui/skeleton";
import { FeedRow, FeedRowSkeleton } from "./components/feed-row";
import { useFolderFeeds } from "./hooks/use-folder-feeds";

/** One placeholder row per width. */
const SKELETON_TITLE_WIDTHS = ["52%", "38%", "64%", "44%", "58%", "34%"] as const;

type FolderScreenProps = {
  readonly folderId: string;
};

/** The feeds filed in one folder, under the native stack header that carries its name. */
export function FolderScreen({ folderId }: FolderScreenProps) {
  const { feeds, folder, isLoading, move, otherFolders, unfollow } = useFolderFeeds(folderId);
  const { height } = useWindowDimensions();
  // The native stack header sits above the list; EmptyState subtracts this to centre in the rest.
  const topContentInset = useSafeAreaInsets().top + 44;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: folder?.name ?? "Folder" }} />
      <FlatList
        contentContainerClassName="pb-4"
        contentInsetAdjustmentBehavior="automatic"
        data={feeds}
        keyExtractor={(feed) => feed.feedId}
        ListEmptyComponent={
          isLoading ? (
            <Skeleton.Repeat count={SKELETON_TITLE_WIDTHS.length}>
              {(index) => <FeedRowSkeleton titleWidth={SKELETON_TITLE_WIDTHS[index]} />}
            </Skeleton.Repeat>
          ) : (
            <EmptyStateView
              height={height}
              topContentInset={topContentInset}
              variant="folder-empty"
            />
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
