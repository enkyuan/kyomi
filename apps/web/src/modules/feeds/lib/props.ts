import type { InboxDensityDto, InboxTimestampDisplayDto } from "@lib/schemas/index";
import type { InboxFilter, InboxItem } from "@modules/inbox/lib/articles/index";

export type Props = {
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
};

function areStringArraysEqual(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function areItemsEqual(a: InboxItem, b: InboxItem) {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.summary === b.summary &&
    a.link === b.link &&
    a.publishedAt === b.publishedAt &&
    a.feedId === b.feedId &&
    a.feedFaviconUrl === b.feedFaviconUrl &&
    a.feedUrl === b.feedUrl &&
    a.feedSiteUrl === b.feedSiteUrl &&
    a.feedTitle === b.feedTitle &&
    a.articleType === b.articleType &&
    a.isSaved === b.isSaved &&
    areStringArraysEqual(a.categories, b.categories)
  );
}

export function arePropsEqual(prev: Props, next: Props) {
  return (
    prev.filter === next.filter &&
    areItemsEqual(prev.item, next.item) &&
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
    prev.onSelect === next.onSelect
  );
}
