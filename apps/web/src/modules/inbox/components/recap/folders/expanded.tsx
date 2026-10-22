"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckIcon,
  EllipsisVerticalIcon,
  FolderIcon,
  PencilIcon,
  PinFilledIcon,
  PinIcon,
  XIcon,
} from "@kyomi/ui/icons/blode";
import { Item, ItemActions } from "@kyomi/ui/components/item";
import { getSvgPath } from "@kyomi/ui/lib/squircle";
import { type CSSProperties, useState } from "react";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@kyomi/ui/components/alert-dialog";
import { Button } from "@kyomi/ui/components/button";
import { Input } from "@kyomi/ui/components/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@kyomi/ui/components/menu";
import { ScrollArea } from "@kyomi/ui/components/scroll-area";
import { toastManager } from "@kyomi/ui/components/toast";
import { getUserSafeErrorMessage, logClientError } from "@kyomi/reader/lib/errors";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { deleteFolder, updateFolder, type Folder } from "@modules/folders/lib/api";
import { applyFolderPinState } from "@modules/inbox/queries/cache";
import type { RecapFolder } from "@modules/inbox/lib/recap/types";
import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";
import { SectionEmpty } from "@modules/inbox/components/recap/sections";
import { invalidateRecapSurface } from "@modules/inbox/lib/recap/index";
import { ExpandedFolderFeeds } from "./feeds";
import { FolderIconBadge } from "./icon";
import { FolderActions, FolderItemTarget } from "./summary";
import { queryKeys } from "@lib/query/keys";

const FOLDER_MANAGE_BUTTON_RADIUS_PX = 7;

const manageButtonSquirclePath = (size: number) =>
  `path('${getSvgPath({ width: size, height: size, cornerRadius: FOLDER_MANAGE_BUTTON_RADIUS_PX, cornerSmoothing: 1 })}')`;

// `icon-xs` buttons are 28px, then 24px from `sm`, so each breakpoint gets a path for its size.
const folderManageButtonSquircleStyle = {
  "--squircle": manageButtonSquirclePath(28),
  "--squircle-sm": manageButtonSquirclePath(24),
  borderRadius: FOLDER_MANAGE_BUTTON_RADIUS_PX,
} as CSSProperties;
const FOLDER_MANAGE_BUTTON_SQUIRCLE_CLASS =
  "[clip-path:var(--squircle)] sm:[clip-path:var(--squircle-sm)]";

type FolderOption = { label: string; value: string };
type RemoveFeedsToastOptions = { anchor?: HTMLElement | null; feedName?: string };
type PinFolderVariables = { folderId: string; isPinned: boolean; name: string };
type PinFolderContext = { previousFolders?: Folder[]; previousRecap?: InboxRecapDto };

function ExpandedFolderRow({ children }: { children: React.ReactNode }) {
  return (
    <Item className="min-h-13" shape="squircle" size="sm">
      {children}
    </Item>
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
        queryClient.invalidateQueries({ queryKey: queryKeys.feeds.followed }),
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
        queryClient.invalidateQueries({ queryKey: queryKeys.feeds.followed }),
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
            icon={<FolderIcon />}
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
                  className={FOLDER_MANAGE_BUTTON_SQUIRCLE_CLASS}
                  data-squircle="7"
                  loading={renameMutation.isPending}
                  size="icon-xs"
                  style={folderManageButtonSquircleStyle}
                  variant="ghost"
                  onClick={() => submitRename(folder)}
                >
                  <CheckIcon />
                </Button>
                <Button
                  aria-label="Cancel rename"
                  className={FOLDER_MANAGE_BUTTON_SQUIRCLE_CLASS}
                  data-squircle="7"
                  size="icon-xs"
                  style={folderManageButtonSquircleStyle}
                  variant="ghost"
                  onClick={cancelEditing}
                >
                  <XIcon />
                </Button>
              </ExpandedFolderRow>
            ) : (
              <ExpandedFolderRow key={folder.id}>
                <FolderItemTarget folder={folder} onSelect={onSelectFolder} />
                <ItemActions>
                  <Menu>
                    <MenuTrigger
                      render={
                        <Button
                          aria-label={`Manage ${folder.name}`}
                          className={FOLDER_MANAGE_BUTTON_SQUIRCLE_CLASS}
                          data-squircle="7"
                          size="icon-xs"
                          style={folderManageButtonSquircleStyle}
                          variant="ghost"
                        >
                          <EllipsisVerticalIcon />
                        </Button>
                      }
                    />
                    <MenuPopup align="end" className="w-36">
                      <MenuItem onClick={() => startEditing(folder)}>
                        <PencilIcon />
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
                          <PinFilledIcon className="opacity-100 text-amber-500" />
                        ) : (
                          <PinIcon className="opacity-70 text-muted-foreground" />
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
                </ItemActions>
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
