"use client";

import { AddFill, CheckFill } from "@mingcute/react";
import { useMemo } from "react";
import { Button } from "@kyomi/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@kyomi/ui/menu";
import { cn } from "@kyomi/ui/lib/utils";

const FOLDER_PICKER_SCROLL_THRESHOLD = 6;
const FOLDER_PICKER_MAX_HEIGHT_CLASS = "!max-h-[min(--spacing(64),var(--available-height))]";

export const TOP_SOURCE_FOLDER_BUTTON_CLASS =
  "size-7 rounded-full bg-primary/14 text-primary before:rounded-full transition-[background-color,color,transform] hover:bg-primary/20 active:scale-[0.96] sm:size-7";

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
  const folderMenuItems = orderedFolders.map((folder) => {
    const isCurrent = !isFollowMode && folder.value === currentFolderId;
    const isUnsorted = folder.label === "Unsorted";
    const menuLabel = isFollowMode
      ? `Follow ${feedTitle} in ${folder.label}`
      : isUnsorted && isFiled
        ? `Move ${feedTitle} to Unsorted`
        : `Move ${feedTitle} to ${folder.label}`;
    return (
      <MenuItem
        key={folder.value}
        aria-label={menuLabel}
        aria-checked={isFollowMode ? undefined : isCurrent}
        className={cn(
          "h-8 cursor-pointer gap-2 rounded-full px-2 text-sm",
          isCurrent && "bg-accent/70 text-accent-foreground",
        )}
        role={isFollowMode ? "menuitem" : "menuitemradio"}
        onClick={() => {
          if (!isFollowMode && isCurrent) {
            return;
          }

          onMove(folder.value);
        }}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {isCurrent ? <CheckFill className="size-3.5" /> : null}
        </span>
        <span className="min-w-0 flex-1 truncate">{folder.label}</span>
      </MenuItem>
    );
  });

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
            size="icon-xs"
            variant="ghost"
          >
            <Icon />
          </Button>
        }
      />
      <MenuPopup
        align="end"
        className={cn(
          "w-40 rounded-[20px] before:rounded-[19px]",
          shouldScrollFolders && "overflow-hidden",
        )}
        contentClassName={
          shouldScrollFolders ? cn(FOLDER_PICKER_MAX_HEIGHT_CLASS, "overflow-y-auto") : undefined
        }
        side="bottom"
        sideOffset={6}
      >
        {folderMenuItems}
      </MenuPopup>
    </Menu>
  );
}
