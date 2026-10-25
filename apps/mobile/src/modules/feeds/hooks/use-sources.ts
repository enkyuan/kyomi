import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo } from "react";
import { mobileApiErrorMessage } from "@/lib/api";
import type { TabBarSourcesProps } from "@ui/tab-bar/lib/types";
import { toast } from "@ui/toast";
import {
  createFolder,
  deleteFolder,
  listFolders,
  listSubscribedFeeds,
  renameFolder,
} from "../lib/api";
import {
  foldersQueryKey,
  subscribedFeedListQueryKey,
  subscribedFeedsQueryKey,
} from "../queries/keys";

/**
 * Backs the tab bar's Sources sheet: the folders with how many feeds each holds, and the handlers
 * for opening, adding, renaming and deleting one. The native sheet owns the prompts and reports
 * the result; this owns the requests.
 */
export function useSources() {
  const queryClient = useQueryClient();
  const folders = useQuery({ queryFn: listFolders, queryKey: foldersQueryKey });
  const feeds = useQuery({ queryFn: listSubscribedFeeds, queryKey: subscribedFeedListQueryKey });

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: foldersQueryKey }),
      queryClient.invalidateQueries({ queryKey: subscribedFeedsQueryKey }),
    ]);
  const onError = (error: unknown) => toast.error(mobileApiErrorMessage(error));
  // `mutate` keeps its identity across renders, so the handlers below stay stable.
  const { mutate: create } = useMutation({ mutationFn: createFolder, onError, onSuccess: refresh });
  const { mutate: rename } = useMutation({ mutationFn: renameFolder, onError, onSuccess: refresh });
  const { mutate: remove } = useMutation({ mutationFn: deleteFolder, onError, onSuccess: refresh });

  const feedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const feed of feeds.data ?? []) {
      if (feed.folderId) counts.set(feed.folderId, (counts.get(feed.folderId) ?? 0) + 1);
    }
    return counts;
  }, [feeds.data]);

  return useMemo<TabBarSourcesProps>(
    () => ({
      folders: (folders.data ?? []).map((folder) => ({
        feedCount: feedCounts.get(folder.id) ?? 0,
        id: folder.id,
        name: folder.name,
      })),
      onCreateFolder: (name) => create(name),
      onDeleteFolder: (folderId) => remove(folderId),
      onOpenFolder: (folderId) =>
        router.push({ params: { folder: folderId }, pathname: "/(protected)/folders/[folder]" }),
      onRenameFolder: (folderId, name) => rename({ folderId, name }),
    }),
    [create, feedCounts, folders.data, remove, rename],
  );
}
