"use client";

import {
  AddFill,
  Delete2Fill,
  FileExportFill,
  ListCheckFill,
  MoveFill,
} from "@kyomi/ui/icons/mingcute";
import { useMemo } from "react";
import { Button } from "@kyomi/ui/components/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@kyomi/ui/components/menu";
import { cn } from "@kyomi/ui/lib/utils";
import { RailTooltip } from "@modules/inbox/components/recap/sections";
import {
  FOLDER_ACTION_BUTTON_CLASS,
  FOLDER_ICON_BUTTON_CLASS,
} from "@modules/inbox/components/recap/folders/summary";

type FolderOption = { label: string; value: string };
const FOLDER_MOVE_SCROLL_THRESHOLD = 4;

export function FolderFeedActions({
  currentFolderId,
  folderOptions,
  hasFeeds,
  isMovingSelected,
  isSelecting,
  onAddSources,
  onExportFeeds,
  onExportSelected,
  onMoveSelected,
  onRemoveSelected,
  onStartSelecting,
  selectedCount,
}: {
  currentFolderId: string;
  folderOptions: FolderOption[];
  hasFeeds: boolean;
  isMovingSelected: boolean;
  isSelecting: boolean;
  onAddSources: () => void;
  onExportFeeds: () => void;
  onExportSelected: () => void;
  onMoveSelected: (folderId: string) => void;
  onRemoveSelected: () => void;
  onStartSelecting: () => void;
  selectedCount: number;
}) {
  const orderedFolders = useMemo(() => {
    const unsortedFolder = folderOptions.find((folder) => folder.label === "Unsorted");
    const ordered = unsortedFolder
      ? [unsortedFolder, ...folderOptions.filter((folder) => folder.value !== unsortedFolder.value)]
      : folderOptions;
    return ordered.filter((folder) => folder.value !== currentFolderId);
  }, [currentFolderId, folderOptions]);
  const shouldScrollFolders = orderedFolders.length > FOLDER_MOVE_SCROLL_THRESHOLD;
  const disabledBulkAction = selectedCount === 0 || isMovingSelected;
  const folderMenuItems = orderedFolders.map((folder) => (
    <MenuItem
      key={folder.value}
      className="cursor-pointer"
      onClick={() => onMoveSelected(folder.value)}
    >
      <span className="min-w-0 flex-1 truncate">{folder.label}</span>
    </MenuItem>
  ));

  if (isSelecting) {
    return (
      <div className="mt-3 grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 px-1">
        <Menu>
          <MenuTrigger
            render={
              <Button
                className={FOLDER_ACTION_BUTTON_CLASS}
                disabled={disabledBulkAction || orderedFolders.length === 0}
                shape="pill"
                variant="secondary"
              >
                <MoveFill className="mx-0 size-4" />
                Move
              </Button>
            }
          />
          <MenuPopup
            align="start"
            className="w-44"
            maxVisibleItems={shouldScrollFolders ? FOLDER_MOVE_SCROLL_THRESHOLD : undefined}
            shape="pill"
            side="top"
            sideOffset={6}
          >
            {folderMenuItems}
          </MenuPopup>
        </Menu>
        <Button
          className={cn(
            FOLDER_ACTION_BUTTON_CLASS,
            "text-destructive hover:bg-destructive/10 data-pressed:bg-destructive/10",
          )}
          disabled={disabledBulkAction}
          variant="secondary"
          onClick={onRemoveSelected}
        >
          <Delete2Fill className="mx-0 size-4" />
          Remove
        </Button>
        <RailTooltip label="Export selected OPML">
          <Button
            aria-label="Export selected OPML"
            className={FOLDER_ICON_BUTTON_CLASS}
            disabled={selectedCount === 0}
            shape="pill"
            variant="outline"
            onClick={onExportSelected}
          >
            <FileExportFill className="mx-0 size-4" />
          </Button>
        </RailTooltip>
      </div>
    );
  }

  return (
    <div className="mt-3 grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 px-1">
      <Button
        className={FOLDER_ACTION_BUTTON_CLASS}
        disabled={!hasFeeds}
        shape="pill"
        variant="secondary"
        onClick={onStartSelecting}
      >
        <ListCheckFill className="mx-0 size-4" />
        Select
      </Button>
      <Button
        className={FOLDER_ACTION_BUTTON_CLASS}
        disabled={!hasFeeds}
        shape="pill"
        variant="secondary"
        onClick={onExportFeeds}
      >
        <FileExportFill className="mx-0 size-4" />
        Export
      </Button>
      <RailTooltip label="Add sources">
        <Button
          aria-label="Add sources"
          className={FOLDER_ICON_BUTTON_CLASS}
          shape="pill"
          variant="outline"
          onClick={onAddSources}
        >
          <AddFill className="mx-0 size-4" />
        </Button>
      </RailTooltip>
    </div>
  );
}
