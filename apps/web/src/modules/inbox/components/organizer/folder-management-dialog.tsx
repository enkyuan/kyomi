"use client";

import { useMutation } from "@tanstack/react-query";
import { CheckFill, CloseFill, Edit2Fill, More2Line } from "@mingcute/react";
import { useState } from "react";
import { Button } from "@kyomi/ui/button";
import {
  Dialog as UiDialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@kyomi/ui/dialog";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "@kyomi/ui/alert-dialog";
import { Input } from "@kyomi/ui/input";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@kyomi/ui/menu";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import { toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { deleteFolder, updateFolder } from "@modules/folders/api";
import type { OrganizerFolder } from "./types";
import { formatFeedCount } from "./utils";
import { SectionEmpty } from "./section";

export function FolderManagementDialog({
  folders,
  open,
  onOpenChange,
  onMutated,
}: {
  folders: OrganizerFolder[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutated: () => Promise<unknown>;
}) {
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OrganizerFolder | null>(null);

  const renameMutation = useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      updateFolder({ data: { folderId, name } }),
    onSuccess: async () => {
      setEditingFolderId(null);
      setDraftName("");
      await onMutated();
      toastManager.add({ title: "Folder renamed", type: "success" });
    },
    onError: (error) => {
      logClientError("inbox.organizer.folder.rename", error);
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
      await onMutated();
      toastManager.add({
        title: "Folder deleted",
        description: "Feeds moved to Unsorted.",
        type: "success",
      });
    },
    onError: (error) => {
      logClientError("inbox.organizer.folder.delete", error);
      toastManager.add({
        title: "Unable to delete folder",
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const startEditing = (folder: OrganizerFolder) => {
    setEditingFolderId(folder.id);
    setDraftName(folder.name);
  };

  const submitRename = (folder: OrganizerFolder) => {
    const name = draftName.trim();
    if (!name || name === folder.name || renameMutation.isPending) {
      return;
    }
    renameMutation.mutate({ folderId: folder.id, name });
  };

  return (
    <>
      <UiDialog open={open} onOpenChange={onOpenChange}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage folders</DialogTitle>
            <DialogDescription>
              Rename folders or delete a folder and move its feeds to Unsorted.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <ScrollArea className="max-h-80 px-6" scrollbarGutter>
              <div className="space-y-1 py-1">
                {folders.length === 0 ? (
                  <SectionEmpty title="No folders" description="Create a folder to manage it." />
                ) : (
                  folders.map((folder) => {
                    const isDefaultFolder = folder.name === "Unsorted";
                    const isEditing = editingFolderId === folder.id;
                    return (
                      <div
                        key={folder.id}
                        className="flex min-h-11 items-center gap-2 rounded-md px-2 hover:bg-accent/70"
                      >
                        {isEditing ? (
                          <>
                            <Input
                              aria-label={`Rename ${folder.name}`}
                              className="min-w-0 flex-1"
                              size="sm"
                              value={draftName}
                              onChange={(event) => setDraftName(event.currentTarget.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  submitRename(folder);
                                }
                              }}
                            />
                            <Button
                              aria-label="Save folder name"
                              loading={renameMutation.isPending}
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => submitRename(folder)}
                            >
                              <CheckFill />
                            </Button>
                            <Button
                              aria-label="Cancel rename"
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => {
                                setEditingFolderId(null);
                                setDraftName("");
                              }}
                            >
                              <CloseFill />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium text-sm">{folder.name}</div>
                              <div className="truncate text-muted-foreground text-xs">
                                {formatFeedCount(folder.feedCount)}
                              </div>
                            </div>
                            <Menu>
                              <MenuTrigger
                                render={
                                  <Button
                                    aria-label={`Manage ${folder.name}`}
                                    size="icon-xs"
                                    variant="ghost"
                                  />
                                }
                              >
                                <More2Line />
                              </MenuTrigger>
                              <MenuPopup align="end">
                                <MenuItem onClick={() => startEditing(folder)}>
                                  <Edit2Fill />
                                  Rename
                                </MenuItem>
                                <MenuItem
                                  disabled={isDefaultFolder}
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(folder)}
                                >
                                  <CloseFill />
                                  Delete
                                </MenuItem>
                              </MenuPopup>
                            </Menu>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </DialogPanel>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogPopup>
      </UiDialog>

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
    </>
  );
}
