"use client";

import {
  ChevronRightIcon,
  FileArrowLeftInFilledIcon,
  FileArrowRightOutFilledIcon,
  FilterDescFilledIcon,
  FolderFilledIcon,
  StarFilledIcon,
  EditBigFilledIcon,
  BarsThreeFilledIcon,
  PencilIcon,
  PinFilledIcon,
  PinIcon,
  PlusCircleFilledIcon,
} from "@kyomi/ui/icons/blode";
import { useRef, useState, type ReactNode } from "react";
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
import { CommandItem } from "@kyomi/ui/components/command";
import {
  ContextMenu,
  ContextMenuPopup,
  ContextMenuTrigger,
} from "@kyomi/ui/components/context-menu";
import { MenuItem } from "@kyomi/ui/components/menu";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { formatFeedCount } from "../../lib/recap/index";
import { matchesRecapTerm } from "../../lib/recap/command-query";
import type { RecapFolder } from "../../lib/recap/types";
import { useFolderMutations } from "./folders/use-folder-mutations";
import { FolderFeeds } from "./folder-feeds";
import { FolderGlyph } from "./folder-glyph";
import { InlineRename } from "./inline-rename";
import { useFeedDrag } from "./use-feed-drag";

export type ManageFoldersProps = {
  exportingOpml: boolean;
  feeds: FollowedFeed[];
  folders: RecapFolder[];
  onCreateFolder: () => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
  moveFeed: (feedId: string, folderId: string) => void;
  onOpenFeed: (feed: FollowedFeed) => void;
};

type FolderSort = "manual" | "name" | "feeds";
const SORT_ORDER: FolderSort[] = ["manual", "name", "feeds"];
const SORT_LABELS: Record<FolderSort, string> = {
  feeds: "Most feeds",
  manual: "Pinned first",
  name: "Name",
};

/**
 * The command menu's folders page, laid out like the main menu: a "Folders" group of rows that open
 * a folder in place as a file tree of its feeds (right-click for rename, pin and delete) and an
 * "Actions" group. The menu's own field
 * (`term`) filters both.
 */
export function ManageFolders({
  exportingOpml,
  feeds,
  folders,
  onCreateFolder,
  onExportOpml,
  onImportOpml,
  moveFeed,
  onOpenFeed,
  editMode,
  pinMode,
  run,
  setEditMode,
  setPinMode,
  term,
}: ManageFoldersProps & {
  editMode: boolean;
  pinMode: boolean;
  run: (action: () => void) => () => void;
  setEditMode: (update: (value: boolean) => boolean) => void;
  setPinMode: (update: (value: boolean) => boolean) => void;
  term: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const draftName = useRef("");
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [sort, setSort] = useState<FolderSort>("manual");
  const [deleteTarget, setDeleteTarget] = useState<RecapFolder | null>(null);
  const { deleteMutation, pinMutation, renameMutation } = useFolderMutations({
    onDeleted: () => setDeleteTarget(null),
    onRenamed: () => {
      setEditingId(null);
      draftName.current = "";
    },
  });

  const unsortedId = folders.find((folder) => folder.name === "Unsorted")?.id ?? null;
  const { drag, dragHandlers, dropTargetId } = useFeedDrag({ editMode, moveFeed, unsortedId });
  const toggle = (id: string) =>
    setExpandedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  const visibleFolders = [...folders]
    .filter((folder) => matchesRecapTerm(folder.name, term))
    .sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sort === "feeds") {
        return b.feedCount - a.feedCount;
      }
      return Number(b.isPinned) - Number(a.isPinned);
    });
  const isOpen = (id: string) => editMode || expandedIds.has(id);
  const nextSort = SORT_ORDER[(SORT_ORDER.indexOf(sort) + 1) % SORT_ORDER.length] ?? "manual";
  const actions = [
    {
      icon: BarsThreeFilledIcon,
      label: editMode ? "Finished editing" : "Edit folders",
      onSelect: () => setEditMode((value) => !value),
      value: "edit-folders",
    },
    {
      icon: StarFilledIcon,
      label: pinMode ? "Finished pinning" : "Pin folders",
      onSelect: () => setPinMode((value) => !value),
      value: "pin-folders",
    },
    {
      icon: FilterDescFilledIcon,
      label: `Sort: ${SORT_LABELS[sort]}`,
      onSelect: () => setSort(nextSort),
      value: "sort-folders",
    },
    {
      icon: PlusCircleFilledIcon,
      label: "Create folder",
      onSelect: run(onCreateFolder),
      value: "create-folder",
    },
    {
      icon: FileArrowLeftInFilledIcon,
      label: "Import OPML",
      onSelect: run(onImportOpml),
      value: "import-opml",
    },
    {
      disabled: exportingOpml,
      icon: FileArrowRightOutFilledIcon,
      label: "Export OPML",
      onSelect: onExportOpml,
      value: "export-opml",
    },
  ].filter((action) => matchesRecapTerm(action.label, term));

  const submitRename = (folder: RecapFolder) => {
    const name = draftName.current.trim();
    if (!name || name === folder.name || renameMutation.isPending) {
      return;
    }
    renameMutation.mutate({ folderId: folder.id, name });
  };
  // The menu treats Enter, Escape and the arrows as its own; the rename field keeps them.

  return (
    <>
      {visibleFolders.length > 0 ? (
        <Group label="Folders">
          {visibleFolders.map((folder) =>
            editingId === folder.id ? (
              <div
                key={folder.id}
                className="flex h-10 items-center gap-2.5 px-2.5 font-medium text-sm"
              >
                <FolderFilledIcon className="kyomi-command-item-icon" />
                <InlineRename
                  label={`Rename ${folder.name}`}
                  name={folder.name}
                  onCancel={() => setEditingId(null)}
                  onChange={(value) => {
                    draftName.current = value;
                  }}
                  onSubmit={() => submitRename(folder)}
                />
              </div>
            ) : (
              <ContextMenu key={folder.id}>
                <ContextMenuTrigger
                  render={
                    <div
                      className={
                        dropTargetId === folder.id ? "rounded-2xl bg-accent/70" : undefined
                      }
                      data-folder-id={folder.id}
                    />
                  }
                >
                  <CommandItem
                    aria-expanded={isOpen(folder.id)}
                    value={`folder-${folder.id}`}
                    onSelect={() => toggle(folder.id)}
                  >
                    <FolderGlyph
                      alwaysStar={pinMode}
                      disabled={pinMutation.isPending}
                      folder={folder}
                      onTogglePin={() =>
                        pinMutation.mutate({
                          folderId: folder.id,
                          isPinned: !folder.isPinned,
                          name: folder.name,
                        })
                      }
                    />
                    <span className="min-w-0 truncate">{folder.name}</span>
                    <sup
                      aria-label={formatFeedCount(folder.feedCount)}
                      className="-ms-2.5 self-start pt-2 font-normal text-[10px] text-muted-foreground tabular-nums leading-none"
                    >
                      {folder.feedCount}
                    </sup>
                    {folder.isPinned ? (
                      <PinFilledIcon aria-label="Pinned" className="size-3.5 text-amber-500" />
                    ) : null}
                    <span className="relative ms-auto grid size-5 shrink-0 place-items-center">
                      <ChevronRightIcon
                        aria-hidden="true"
                        className={`absolute size-4 text-muted-foreground transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${isOpen(folder.id) ? "rotate-90" : ""} ${editMode ? "opacity-0" : ""}`}
                      />
                      <button
                        aria-label={`Rename ${folder.name}`}
                        className={`absolute grid size-5 place-items-center rounded-md text-muted-foreground transition-opacity duration-200 ease-out hover:text-foreground motion-reduce:transition-none ${editMode ? "" : "pointer-events-none opacity-0"}`}
                        tabIndex={editMode ? 0 : -1}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingId(folder.id);
                          draftName.current = folder.name;
                        }}
                      >
                        <EditBigFilledIcon className="size-3.5" />
                      </button>
                    </span>
                  </CommandItem>
                  {isOpen(folder.id) ? (
                    <FolderFeeds
                      feeds={feeds.filter((feed) => (feed.folderId ?? unsortedId) === folder.id)}
                      onOpenFeed={run}
                      drag={drag}
                      dragHandlers={dragHandlers}
                      editMode={editMode}
                      open={onOpenFeed}
                    />
                  ) : null}
                </ContextMenuTrigger>
                <ContextMenuPopup className="w-40">
                  <MenuItem
                    onClick={() => {
                      setEditingId(folder.id);
                      draftName.current = folder.name;
                    }}
                  >
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
                      <PinFilledIcon className="text-amber-500 opacity-100" />
                    ) : (
                      <PinIcon className="text-muted-foreground opacity-70" />
                    )}
                    {folder.isPinned ? "Unpin" : "Pin"}
                  </MenuItem>
                  {folder.name === "Unsorted" ? null : (
                    <MenuItem variant="destructive" onClick={() => setDeleteTarget(folder)}>
                      <span aria-hidden className="size-3" />
                      Delete
                    </MenuItem>
                  )}
                </ContextMenuPopup>
              </ContextMenu>
            ),
          )}
        </Group>
      ) : null}
      {actions.length > 0 ? (
        <Group label="Actions">
          {actions.map(({ disabled, icon: Icon, label, onSelect, value }) => (
            <CommandItem key={value} disabled={disabled} value={value} onSelect={onSelect}>
              <Icon className="kyomi-command-item-icon" />
              {label}
            </CommandItem>
          ))}
        </Group>
      ) : null}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
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

export function Group({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="pb-1">
      <div className="kyomi-command-group-label">{label}</div>
      {children}
    </div>
  );
}
