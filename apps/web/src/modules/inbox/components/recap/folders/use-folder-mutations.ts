"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastManager } from "@kyomi/ui/components/toast";
import { logClientError } from "@kyomi/reader/lib/errors";
import { deleteFolder, updateFolder, type Folder } from "@modules/folders/lib/api";
import { applyFolderPinState } from "@modules/inbox/queries/cache";
import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";
import { invalidateRecapSurface } from "@modules/inbox/lib/recap/index";
import { queryKeys } from "@lib/query/keys";

type PinFolderVariables = { folderId: string; isPinned: boolean; name: string };
type PinFolderContext = { previousFolders?: Folder[]; previousRecap?: InboxRecapDto };

/** Rename, delete and pin mutations for folders, shared by every surface that lists them. */
export function useFolderMutations({
  onRenamed,
  onDeleted,
}: { onRenamed?: () => void; onDeleted?: () => void } = {}) {
  const queryClient = useQueryClient();

  const renameMutation = useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      updateFolder({ data: { folderId, name } }),
    onSuccess: async () => {
      onRenamed?.();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.feeds.followed }),
        invalidateRecapSurface(queryClient),
      ]);
      toastManager.add({ title: "Folder renamed", type: "success" });
    },
    onError: (error) => {
      logClientError("inbox.recap.folder.rename", error);
      toastManager.add({
        title: "Unable to rename folder",
        type: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ folderId }: { folderId: string }) => deleteFolder({ data: { folderId } }),
    onSuccess: async () => {
      onDeleted?.();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.feeds.followed }),
        invalidateRecapSurface(queryClient),
      ]);
      toastManager.add({
        title: "Folder deleted",
        type: "success",
      });
    },
    onError: (error) => {
      logClientError("inbox.recap.folder.delete", error);
      toastManager.add({
        title: "Unable to delete folder",
        type: "error",
      });
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ folderId, isPinned, name }: PinFolderVariables) =>
      updateFolder({ data: { folderId, isPinned, name } }),
    onMutate: async (variables): Promise<PinFolderContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.inbox.recap }),
        queryClient.cancelQueries({ queryKey: queryKeys.folders.all }),
      ]);
      const previousRecap = queryClient.getQueryData<InboxRecapDto>(queryKeys.inbox.recap);
      const previousFolders = queryClient.getQueryData<Folder[]>(queryKeys.folders.all);
      applyFolderPinState(queryClient, variables.folderId, variables.isPinned);
      return { previousFolders, previousRecap };
    },
    onSuccess: async (updated, variables) => {
      const returnedFolder = updated as Partial<Folder>;
      const isPinned =
        typeof returnedFolder.isPinned === "boolean" ? returnedFolder.isPinned : variables.isPinned;
      const pinnedAt =
        returnedFolder.pinnedAt !== undefined
          ? returnedFolder.pinnedAt
          : isPinned
            ? new Date().toISOString()
            : null;
      applyFolderPinState(queryClient, variables.folderId, isPinned, pinnedAt);
      toastManager.add({
        title: isPinned ? "Folder pinned" : "Folder unpinned",
        type: "success",
      });
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(queryKeys.inbox.recap, context?.previousRecap);
      queryClient.setQueryData(queryKeys.folders.all, context?.previousFolders);
      logClientError("inbox.recap.folder.pin", error);
      toastManager.add({
        title: "Unable to update folder pin",
        type: "error",
      });
    },
  });

  return { deleteMutation, pinMutation, renameMutation };
}
