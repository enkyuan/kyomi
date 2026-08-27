"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckFill,
  CloseFill,
  Edit2Fill,
  Folder2Fill,
  More2Fill,
  PinFill,
  PinLine,
} from "@kyomi/ui/icons/mingcute";
import { createSquircleStyle, useSquircle } from "@kyomi/ui/lib/squircle";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@kyomi/ui/alert-dialog";
import { Button } from "@kyomi/ui/button";
import { Input } from "@kyomi/ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@kyomi/ui/menu";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import { toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@kyomi/reader/lib/errors";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { deleteFolder, updateFolder, type Folder } from "@modules/folders/lib/api";
import { applyFolderPinState } from "@modules/folders/queries/cache";
import type { RecapFolder } from "@modules/folders/lib/types";
import { followedFeedsQueryKey, inboxRecapQueryKey } from "@modules/inbox/queries/options";
import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";
import { SectionEmpty } from "@modules/inbox/components/recap/sections";
import { formatFeedCount, invalidateRecapSurface } from "@modules/inbox/lib/recap/index";
import { ExpandedFolderFeeds } from "../feeds";
import { FolderIconBadge } from "./folder-icon";
import { FolderActions } from "./summary";

const FOLDER_MANAGE_BUTTON_SIZE_PX = 30;

const folderManageButtonSquircleStyle = createSquircleStyle({
  width: FOLDER_MANAGE_BUTTON_SIZE_PX,
  height: FOLDER_MANAGE_BUTTON_SIZE_PX,
  cornerRadius: 7,
  cornerSmoothing: 1,
});

type FolderOption = { label: string; value: string };
type RemoveFeedsToastOptions = { anchor?: HTMLElement | null; feedName?: string };
type PinFolderVariables = { folderId: string; isPinned: boolean; name: string };
type PinFolderContext = { previousFolders?: Folder[]; previousRecap?: InboxRecapDto };

function ExpandedFolderRow({ children }: { children: React.ReactNode }) {
  const { ref, style } = useSquircle<HTMLDivElement>(16, 1);
  return (
    <div
      ref={ref}
      style={style}
      className="group flex h-13 w-full min-w-0 items-center gap-2.5 px-2 text-base transition-colors hover:bg-accent/70"
    >
      {children}
    </div>
  );
}

export function ExpandedFolders({
  folders,
  followedFeeds,
  followedFeedsLoading,
  folderOptions,
  moveFeed,
  moveFeeds,
  movingFeedIds,
  movingFeedId,
  removeFeeds,
  removingFeedIds,
  selectedFolder,
  unsortedFolderId,
  exportingOpml,
  onCreateFolder,
  onExportOpml,
  onImportOpml,
  onSelectFolder,
}: {
  folders: RecapFolder[];
  followedFeeds: FollowedFeed[];
  followedFeedsLoading: boolean;
  folderOptions: FolderOption[];
  moveFeed: (feedId: string, folderId: string) => void;
  moveFeeds: (feedIds: string[], folderId: string) => void;
  movingFeedIds: string[];
  movingFeedId: string | null;
  removeFeeds: (feedIds: string[], options?: RemoveFeedsToastOptions) => void;
  removingFeedIds: string[];
  selectedFolder: RecapFolder | null;
  unsortedFolderId: string | null;
  exportingOpml: boolean;
  onCreateFolder: () => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
  onSelectFolder: (folder: RecapFolder) => void;
}) {
  const queryClient = useQueryClient();
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<RecapFolder | null>(null);

  const renameMutation = useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      updateFolder({ data: { folderId, name } }),
    onSuccess: async () => {
      setEditingFolderId(null);
      setDraftName("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: followedFeedsQueryKey() }),
        invalidateRecapSurface(queryClient),
      ]);
      toastManager.add({ title: "Folder renamed", type: "success" });
    },
    onError: (error) => {
      logClientError("inbox.recap.folder.rename", error);
      toastManager.add({
        title: "Unable to rename folder",
        description: getUserSafeErrorMessage(error, "Try a different name."),
        type: "error",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ folderId }: { folderId: string }) => deleteFolder({ data: { folderId } }),
    onSuccess: async () => {
      setDeleteTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: followedFeedsQueryKey() }),
        invalidateRecapSurface(queryClient),
      ]);
      toastManager.add({
        title: "Folder deleted",
        description: "Feeds moved to Unsorted.",
        type: "success",
      });
    },
    onError: (error) => {
      logClientError("inbox.recap.folder.delete", error);
      toastManager.add({
        title: "Unable to delete folder",
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ folderId, isPinned, name }: PinFolderVariables) =>
      updateFolder({ data: { folderId, isPinned, name } }),
    onMutate: async (variables): Promise<PinFolderContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: inboxRecapQueryKey() }),
        queryClient.cancelQueries({ queryKey: ["folders"] }),
      ]);
      const previousRecap = queryClient.getQueryData<InboxRecapDto>(inboxRecapQueryKey());
      const previousFolders = queryClient.getQueryData<Folder[]>(["folders"]);
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
      queryClient.setQueryData(inboxRecapQueryKey(), context?.previousRecap);
      queryClient.setQueryData(["folders"], context?.previousFolders);
      logClientError("inbox.recap.folder.pin", error);
      toastManager.add({
        title: "Unable to update folder pin",
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const startEditing = (folder: RecapFolder) => {
    setEditingFolderId(folder.id);
    setDraftName(folder.name);
  };

  const cancelEditing = () => {
    setEditingFolderId(null);
    setDraftName("");
  };

  const submitRename = (folder: RecapFolder) => {
    const name = draftName.trim();
    if (!name || name === folder.name || renameMutation.isPending) {
      return;
    }
    renameMutation.mutate({ folderId: folder.id, name });
  };

  if (selectedFolder) {
    return (
      <ExpandedFolderFeeds
        feeds={followedFeeds}
        folder={selectedFolder}
        folderOptions={folderOptions}
        isLoading={followedFeedsLoading}
        moveFeed={moveFeed}
        moveFeeds={moveFeeds}
        movingFeedIds={movingFeedIds}
        movingFeedId={movingFeedId}
        removeFeeds={removeFeeds}
        removingFeedIds={removingFeedIds}
        onImportOpml={onImportOpml}
        unsortedFolderId={unsortedFolderId}
      />
    );
  }

  if (folders.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col px-4">
        <div className="flex min-h-0 flex-1">
          <SectionEmpty
            title="No folders yet"
            description="Create a folder to group feeds."
            icon={<Folder2Fill />}
          />
        </div>
        <FolderActions
          exportingOpml={exportingOpml}
          onCreateFolder={onCreateFolder}
          onExportOpml={onExportOpml}
          onImportOpml={onImportOpml}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScrollArea className="min-h-0 flex-1" scrollbarGutter>
        <div className="min-w-0 space-y-3 px-4 pb-1">
          {folders.map((folder) => {
            const isDefaultFolder = folder.name === "Unsorted";
            const isEditing = editingFolderId === folder.id;

            return isEditing ? (
              <ExpandedFolderRow key={folder.id}>
                <FolderIconBadge />
                <Input
                  aria-label={`Rename ${folder.name}`}
                  className="h-8 min-w-0 flex-1"
                  size="sm"
                  value={draftName}
                  autoFocus
                  onChange={(event) => setDraftName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      submitRename(folder);
                    }
                    if (event.key === "Escape") {
                      cancelEditing();
                    }
                  }}
                />
                <Button
                  aria-label="Save folder name"
                  data-squircle="7"
                  loading={renameMutation.isPending}
                  size="icon-xs"
                  style={folderManageButtonSquircleStyle}
                  variant="ghost"
                  onClick={() => submitRename(folder)}
                >
                  <CheckFill />
                </Button>
                <Button
                  aria-label="Cancel rename"
                  data-squircle="7"
                  size="icon-xs"
                  style={folderManageButtonSquircleStyle}
                  variant="ghost"
                  onClick={cancelEditing}
                >
                  <CloseFill />
                </Button>
              </ExpandedFolderRow>
            ) : (
              <ExpandedFolderRow key={folder.id}>
                <button
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                  type="button"
                  onClick={() => onSelectFolder(folder)}
                >
                  <FolderIconBadge />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm leading-5">
                      {folder.name}
                    </span>
                    <span className="block truncate text-muted-foreground text-xs leading-4">
                      {formatFeedCount(folder.feedCount)}
                    </span>
                  </span>
                </button>
                <Menu>
                  <MenuTrigger
                    render={
                      <Button
                        aria-label={`Manage ${folder.name}`}
                        data-squircle="7"
                        size="icon-xs"
                        style={folderManageButtonSquircleStyle}
                        variant="ghost"
                      >
                        <More2Fill />
                      </Button>
                    }
                  />
                  <MenuPopup align="end" className="w-36">
                    <MenuItem onClick={() => startEditing(folder)}>
                      <Edit2Fill />
                      Rename
                    </MenuItem>
                    <MenuItem
                      disabled={pinMutation.isPending}
                      onClick={() =>
                        pinMutation.mutate({
                          folderId: folder.id,
                          isPinned: !folder.isPinned,
                          name: folder.name,
                        })
                      }
                    >
                      {folder.isPinned ? (
                        <PinFill className="opacity-100 text-amber-500" />
                      ) : (
                        <PinLine className="opacity-70 text-muted-foreground" />
                      )}
                      {folder.isPinned ? "Unpin" : "Pin"}
                    </MenuItem>
                    {!isDefaultFolder ? (
                      <MenuItem variant="destructive" onClick={() => setDeleteTarget(folder)}>
                        <span aria-hidden className="size-3" />
                        Delete
                      </MenuItem>
                    ) : null}
                  </MenuPopup>
                </Menu>
              </ExpandedFolderRow>
            );
          })}
        </div>
      </ScrollArea>
      <div className="px-4">
        <FolderActions
          exportingOpml={exportingOpml}
          onCreateFolder={onCreateFolder}
          onExportOpml={onExportOpml}
          onImportOpml={onImportOpml}
        />
      </div>
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              Feeds in {deleteTarget?.name ?? "this folder"} will move to Unsorted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>Cancel</AlertDialogClose>
            <Button
              loading={deleteMutation.isPending}
              variant="destructive"
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ folderId: deleteTarget.id });
                }
              }}
            >
              Delete folder
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  );
}
