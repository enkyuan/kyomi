import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { mobileApiErrorMessage } from "@/lib/api";
import { listFolders, listSubscribedFeeds, moveFeedToFolder, unfollowFeed } from "../lib/api";
import {
  foldersQueryKey,
  subscribedFeedListQueryKey,
  subscribedFeedsQueryKey,
} from "../queries/keys";

/** The feeds filed in one folder, the other folders they can move to, and what can be done to a feed. */
export function useFolderFeeds(folderId: string) {
  const queryClient = useQueryClient();
  const folders = useQuery({ queryFn: listFolders, queryKey: foldersQueryKey });
  const feeds = useQuery({ queryFn: listSubscribedFeeds, queryKey: subscribedFeedListQueryKey });

  const onError = (error: unknown) =>
    Alert.alert("Couldn't update the feed", mobileApiErrorMessage(error));
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: subscribedFeedsQueryKey });
  const { mutate: move } = useMutation({ mutationFn: moveFeedToFolder, onError, onSuccess });
  const { mutate: unfollow } = useMutation({ mutationFn: unfollowFeed, onError, onSuccess });

  return {
    feeds: feeds.data?.filter((feed) => feed.folderId === folderId) ?? [],
    folder: folders.data?.find((folder) => folder.id === folderId),
    isLoading: feeds.isPending,
    move,
    otherFolders: folders.data?.filter((folder) => folder.id !== folderId) ?? [],
    unfollow,
  };
}
