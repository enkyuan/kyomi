import type { FocusEvent, PointerEvent } from "react";
import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/api-schemas";
import type { InboxFilter, InboxItem } from "../services/api";

export type FeedItemProps = {
  filter: InboxFilter;
  item: InboxItem;
  isSelected: boolean;
  isFirst: boolean;
  showBottomSeparator: boolean;
  containerWidth?: number;
  readerFocusMode?: boolean;
  density: InboxDensityDto;
  fontSizePx: number;
  showFavicons: boolean;
  timestampDisplay: InboxTimestampDisplayDto;
  timestampHourCycle: "12h" | "24h";
  onSelect: (item: InboxItem) => void;
  onToolbarEnter: (item: InboxItem, anchorElement: HTMLElement) => void;
  onToolbarLeave: (event: FocusEvent<HTMLElement> | PointerEvent<HTMLElement>) => void;
};

function areFeedItemsEqual(a: InboxItem, b: InboxItem) {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.summary === b.summary &&
    a.link === b.link &&
    a.publishedAt === b.publishedAt &&
    a.feedFaviconUrl === b.feedFaviconUrl &&
    a.feedTitle === b.feedTitle &&
    a.articleType === b.articleType &&
    a.isRead === b.isRead &&
    a.isSaved === b.isSaved
  );
}

export function areFeedItemPropsEqual(prev: FeedItemProps, next: FeedItemProps) {
  return (
    prev.filter === next.filter &&
    areFeedItemsEqual(prev.item, next.item) &&
    prev.isSelected === next.isSelected &&
    prev.isFirst === next.isFirst &&
    prev.showBottomSeparator === next.showBottomSeparator &&
    prev.containerWidth === next.containerWidth &&
    prev.readerFocusMode === next.readerFocusMode &&
    prev.density === next.density &&
    prev.fontSizePx === next.fontSizePx &&
    prev.showFavicons === next.showFavicons &&
    prev.timestampDisplay === next.timestampDisplay &&
    prev.timestampHourCycle === next.timestampHourCycle &&
    prev.onSelect === next.onSelect &&
    prev.onToolbarEnter === next.onToolbarEnter &&
    prev.onToolbarLeave === next.onToolbarLeave
  );
}
