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
  reorderFolders,
  type Folder,
} from "../lib/api";
import {
  foldersQueryKey,
  subscribedFeedListQueryKey,
  subscribedFeedsQueryKey,
} from "../queries/keys";

/**
 * Backs the tab bar's Sources sheet: the folders with how many feeds each holds, and the handlers
 * for adding, renaming, reordering and deleting them. The native sheet owns the prompts and reports
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
  // The sheet shows the new order the moment it is dropped, so the cache is reordered ahead of the
  // request and put back if it fails.
  const { mutate: reorder } = useMutation({
    mutationFn: reorderFolders,
    // A failed drop puts the row back, which is the feedback; a toast over the sheet adds nothing.
    onError: (_error, _ids, previous) => {
      if (previous) queryClient.setQueryData(foldersQueryKey, previous);
    },
    onMutate: async (folderIds) => {
      await queryClient.cancelQueries({ queryKey: foldersQueryKey });
      const previous = queryClient.getQueryData<Folder[]>(foldersQueryKey);
      if (previous) {
        const byId = new Map(previous.map((folder) => [folder.id, folder]));
        const moved = folderIds.flatMap((id) => byId.get(id) ?? []);
        const rest = previous.filter((folder) => !folderIds.includes(folder.id));
        queryClient.setQueryData(foldersQueryKey, [...moved, ...rest]);
      }
      return previous;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: foldersQueryKey }),
  });
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
      feeds: (feeds.data ?? []).flatMap((feed) =>
        feed.folderId
          ? [
              {
                faviconUrl: feed.faviconUrl ?? undefined,
                folderId: feed.folderId,
                id: feed.feedId,
                title: feed.customTitle ?? feed.title,
              },
            ]
          : [],
      ),
      folders: (folders.data ?? []).map((folder) => ({
        createdAt: folder.createdAt,
        feedCount: feedCounts.get(folder.id) ?? 0,
        id: folder.id,
        name: folder.name,
      })),
      onCreateFolder: (name) => create(name),
      onDeleteFolder: (folderId) => remove(folderId),
      onImport: () => router.push("/(protected)/settings/import-opml"),
      onRenameFolder: (folderId, name) => rename({ folderId, name }),
      onReorderFolders: (folderIds) => reorder(folderIds),
    }),
    [create, feedCounts, feeds.data, folders.data, remove, rename, reorder],
  );
}
