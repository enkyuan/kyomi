"use client";

import { useRef, type FocusEvent, type PointerEvent } from "react";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas";
import { Item } from "@modules/feeds/components/item";
import type { InboxFilter, InboxItem } from "@modules/inbox/services/api";

export type StaticRowsProps = {
  filter: InboxFilter;
  readerFocusMode: boolean;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  listContainerWidth?: number;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  inboxItems: InboxItem[];
  selectedItemId?: string | null;
  onSelectItem: (item: InboxItem) => void;
  onToolbarEnter: (
    item: InboxItem,
    anchorElement: HTMLElement,
    toolbarHostElement: HTMLElement,
  ) => void;
  onToolbarLeave: (event: FocusEvent<HTMLElement> | PointerEvent<HTMLElement>) => void;
};

export function StaticRows({
  filter,
  readerFocusMode,
  density,
  fontSizePx,
  showFavicons,
  listContainerWidth,
  timestampDisplay,
  timestampHourCycle,
  inboxItems,
  selectedItemId,
  onSelectItem,
  onToolbarEnter,
  onToolbarLeave,
}: StaticRowsProps) {
  const toolbarHostRef = useRef<HTMLDivElement | null>(null);
  const showToolbar = (item: InboxItem, anchorElement: HTMLElement) => {
    if (toolbarHostRef.current) {
      onToolbarEnter(item, anchorElement, toolbarHostRef.current);
    }
  };

  return (
    <div ref={toolbarHostRef} className="relative w-full pb-4">
      {inboxItems.map((item, index) => (
        <div key={item.id} className="group/inbox-row relative w-full">
          <Item
            filter={filter}
            item={item}
            isSelected={selectedItemId === item.id}
            isFirst={index === 0}
            containerWidth={listContainerWidth || undefined}
            readerFocusMode={readerFocusMode}
            showBottomSeparator={index === inboxItems.length - 1}
            density={density}
            fontSizePx={fontSizePx}
            showFavicons={showFavicons}
            timestampDisplay={timestampDisplay}
            timestampHourCycle={timestampHourCycle}
            onSelect={onSelectItem}
            onToolbarEnter={showToolbar}
            onToolbarLeave={onToolbarLeave}
          />
        </div>
      ))}
    </div>
  );
}
