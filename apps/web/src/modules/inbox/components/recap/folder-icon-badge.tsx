"use client";

import { Folder2Fill } from "@mingcute/react";
import { getSvgPath } from "figma-squircle";
import type { CSSProperties } from "react";

const folderIconSquirclePath = getSvgPath({
  width: 36,
  height: 36,
  cornerRadius: 8,
  cornerSmoothing: 1,
});

const folderIconSquircleStyle = {
  borderRadius: 8,
  clipPath: `path('${folderIconSquirclePath}')`,
  WebkitClipPath: `path('${folderIconSquirclePath}')`,
} satisfies CSSProperties;

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
