import type { ArticleListItemDto } from "@modules/articles/types";

export type InboxOrganizerFolderDto = {
  id: string;
  name: string;
  createdAt: string;
  feedCount: number;
};

export type InboxOrganizerTopViewedFeedDto = {
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

export type InboxOrganizerSavedItemDto = ArticleListItemDto & {
  savedAt: string;
};

export type InboxOrganizerDto = {
  folders: InboxOrganizerFolderDto[];
  topViewedFeeds: InboxOrganizerTopViewedFeedDto[];
  oldestSavedItems: InboxOrganizerSavedItemDto[];
};
