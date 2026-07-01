import { t } from "elysia";

export const inboxOrganizerQuerySchema = t.Object({
  limit: t.Optional(t.String()),
});

export const inboxOrganizerFolderSchema = t.Object({
  id: t.String(),
  name: t.String(),
  createdAt: t.String(),
  feedCount: t.Number(),
});

export const inboxOrganizerTopViewedFeedSchema = t.Object({
  feedId: t.String(),
  title: t.String(),
  url: t.String(),
  siteUrl: t.Union([t.String(), t.Null()]),
  faviconUrl: t.Union([t.String(), t.Null()]),
  viewedItemCount: t.Number(),
  lastViewedAt: t.String(),
  isSubscribed: t.Boolean(),
  folderId: t.Union([t.String(), t.Null()]),
  folderName: t.Union([t.String(), t.Null()]),
});

export const inboxOrganizerSavedItemSchema = t.Object({
  id: t.String(),
  title: t.String(),
  link: t.String(),
  summary: t.Union([t.String(), t.Null()]),
  publishedAt: t.String(),
  feedId: t.String(),
  feedUrl: t.Union([t.String(), t.Null()]),
  feedSiteUrl: t.Union([t.String(), t.Null()]),
  feedTitle: t.String(),
  feedFaviconUrl: t.Union([t.String(), t.Null()]),
  isRead: t.Boolean(),
  isSaved: t.Boolean(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
  savedAt: t.String(),
});

export const inboxOrganizerResponseSchema = t.Object({
  folders: t.Array(inboxOrganizerFolderSchema),
  topViewedFeeds: t.Array(inboxOrganizerTopViewedFeedSchema),
  oldestSavedItems: t.Array(inboxOrganizerSavedItemSchema),
});
