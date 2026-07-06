"use client";

import { AddFill, Delete2Fill, FileExportFill, ListCheckFill, MoveFill } from "@mingcute/react";
import { useMemo } from "react";
import { Button } from "@kyomi/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@kyomi/ui/menu";
import { cn } from "@kyomi/ui/lib/utils";
import { RailTooltip } from "@modules/inbox/components/recap/sections";
import {
  FOLDER_ACTION_BUTTON_CLASS,
  FOLDER_ICON_BUTTON_CLASS,
} from "@modules/folders/components/recap/summary";

type FolderOption = { label: string; value: string };
const FOLDER_MOVE_SCROLL_THRESHOLD = 4;
const FOLDER_MOVE_MAX_HEIGHT_CLASS =
  "!max-h-[min(calc(--spacing(8)*4+--spacing(2)+1px),var(--available-height))]";

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
      className="h-8 cursor-pointer rounded-full px-3 text-sm"
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
                variant="secondary"
              >
                <MoveFill className="!mx-0 size-4" />
                Move
              </Button>
            }
          />
          <MenuPopup
            align="start"
            className={cn(
              "w-44 rounded-[20px] before:rounded-[19px]",
              shouldScrollFolders && "overflow-hidden",
            )}
            contentClassName={shouldScrollFolders ? FOLDER_MOVE_MAX_HEIGHT_CLASS : undefined}
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
          <Delete2Fill className="!mx-0 size-4" />
          Remove
        </Button>
        <RailTooltip label="Export selected OPML">
          <Button
            aria-label="Export selected OPML"
            className={FOLDER_ICON_BUTTON_CLASS}
            disabled={selectedCount === 0}
            variant="outline"
            onClick={onExportSelected}
          >
            <FileExportFill className="!mx-0 size-4" />
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
        variant="secondary"
        onClick={onStartSelecting}
      >
        <ListCheckFill className="!mx-0 size-4" />
        Select
      </Button>
      <Button
        className={FOLDER_ACTION_BUTTON_CLASS}
        disabled={!hasFeeds}
        variant="secondary"
        onClick={onExportFeeds}
      >
        <FileExportFill className="!mx-0 size-4" />
        Export
      </Button>
      <RailTooltip label="Add sources">
        <Button
          aria-label="Add sources"
          className={FOLDER_ICON_BUTTON_CLASS}
          variant="outline"
          onClick={onAddSources}
        >
          <AddFill className="!mx-0 size-4" />
        </Button>
      </RailTooltip>
    </div>
  );
}
