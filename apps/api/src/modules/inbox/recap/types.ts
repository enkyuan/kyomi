import type { ArticleListItemDto } from "@modules/articles/types";

export type InboxRecapFolderDto = {
  id: string;
  name: string;
  createdAt: string;
  isPinned: boolean;
  pinnedAt: string | null;
  feedCount: number;
};

export type InboxRecapTopViewedFeedDto = {
  feedId: string;
  title: string;
  url: string;
  siteUrl: string | null;
  faviconUrl: string | null;
  viewedItemCount: number;
  lastViewedAt: string;
  isSubscribed: boolean;
  folderId: string | null;
  folderName: string | null;
};

export type InboxRecapSavedItemDto = ArticleListItemDto & {
  savedAt: string;
};

export type InboxRecapDto = {
  folders: InboxRecapFolderDto[];
  topViewedFeeds: InboxRecapTopViewedFeedDto[];
  oldestSavedItems: InboxRecapSavedItemDto[];
};
