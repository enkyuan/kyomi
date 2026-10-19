"use client";

import { createSquircleStyle } from "@kyomi/ui/lib/squircle";
import { Folder2Fill } from "@kyomi/ui/icons/mingcute";

// Matches the rendered `size-9` box; a path built for another size distorts the corners.
const FOLDER_ICON_BADGE_SIZE_PX = 36;

const folderIconSquircleStyle = createSquircleStyle({
  width: FOLDER_ICON_BADGE_SIZE_PX,
  height: FOLDER_ICON_BADGE_SIZE_PX,
  cornerRadius: 8,
  cornerSmoothing: 1,
});

export function FolderIconBadge() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center bg-muted text-muted-foreground"
      data-squircle="8"
      style={folderIconSquircleStyle}
    >
      <Folder2Fill className="block size-4 shrink-0" />
    </span>
  );
}
