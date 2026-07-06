"use client";

import { createSquircleStyle } from "@kyomi/ui/lib/squircle";
import { Folder2Fill } from "@kyomi/ui/icons/mingcute";

const folderIconSquircleStyle = createSquircleStyle({
  width: 36,
  height: 36,
  cornerRadius: 8,
  cornerSmoothing: 1,
});

export function FolderIconBadge() {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center bg-muted text-muted-foreground"
      data-squircle="8"
      style={folderIconSquircleStyle}
    >
      <Folder2Fill className="size-4" />
    </span>
  );
}
