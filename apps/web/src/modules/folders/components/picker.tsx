"use client";

import { AddFill, CheckFill } from "@kyomi/ui/icons/mingcute";
import { useMemo } from "react";
import { Button } from "@kyomi/ui/components/button";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@kyomi/ui/components/menu";

const FOLDER_PICKER_SCROLL_THRESHOLD = 4;

export const TOP_SOURCE_FOLDER_BUTTON_CLASS = "size-7 sm:size-7";

export function FolderPickerButton({
  currentFolderId,
  currentFolderName,
  feedTitle,
  folders,
  isMoving,
  mode = "move",
  onMove,
}: {
  currentFolderId: string;
  currentFolderName: string;
  feedTitle: string;
  folders: Array<{ label: string; value: string }>;
  isMoving: boolean;
  mode?: "move" | "follow";
  onMove: (folderId: string) => void;
}) {
  const isFollowMode = mode === "follow";
  const isFiled = !isFollowMode && currentFolderName !== "Unsorted";
  const Icon = isFiled ? CheckFill : AddFill;
  const orderedFolders = useMemo(() => {
    const unsortedFolder = folders.find((folder) => folder.label === "Unsorted");
    if (!unsortedFolder) {
      return folders;
    }
    return [unsortedFolder, ...folders.filter((folder) => folder.value !== unsortedFolder.value)];
  }, [folders]);
  const shouldScrollFolders = orderedFolders.length > FOLDER_PICKER_SCROLL_THRESHOLD;
  const menuLabel = (folder: { label: string }) =>
    isFollowMode
      ? `Follow ${feedTitle} in ${folder.label}`
      : folder.label === "Unsorted" && isFiled
        ? `Move ${feedTitle} to Unsorted`
        : `Move ${feedTitle} to ${folder.label}`;
  const folderMenuItems = isFollowMode ? (
    orderedFolders.map((folder) => (
      <MenuItem
        key={folder.value}
        aria-label={menuLabel(folder)}
        className="cursor-pointer"
        onClick={() => onMove(folder.value)}
      >
        <span className="min-w-0 flex-1 truncate">{folder.label}</span>
      </MenuItem>
    ))
  ) : (
    <MenuRadioGroup value={currentFolderId} onValueChange={(folderId: string) => onMove(folderId)}>
      {orderedFolders.map((folder) => (
        <MenuRadioItem
          key={folder.value}
          aria-label={menuLabel(folder)}
          className="cursor-pointer data-checked:bg-accent/70 data-checked:text-accent-foreground"
          closeOnClick
          value={folder.value}
        >
          <span className="min-w-0 flex-1 truncate">{folder.label}</span>
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );

  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            aria-label={
              isFollowMode
                ? `Choose folder for ${feedTitle}`
                : isFiled
                  ? `${feedTitle} is in ${currentFolderName}. Change folder.`
                  : `Add ${feedTitle} to a folder`
            }
            className={TOP_SOURCE_FOLDER_BUTTON_CLASS}
            loading={isMoving}
            shape="pill"
            size="icon-xs"
            variant="soft"
          >
            <Icon />
          </Button>
        }
      />
      <MenuPopup
        align="end"
        className="w-40"
        maxVisibleItems={shouldScrollFolders ? FOLDER_PICKER_SCROLL_THRESHOLD : undefined}
        shape="pill"
        side="bottom"
        sideOffset={6}
      >
        {folderMenuItems}
      </MenuPopup>
    </Menu>
  );
}
