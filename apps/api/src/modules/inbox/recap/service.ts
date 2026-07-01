import type { db } from "@adapters/db/client";
import {
  articleClips,
  feedItems,
  feedItemUserState,
  feeds,
  feedSubscriptions,
  feedUserStats,
  folders,
} from "@kyomi/db";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { articleIsReadSql } from "@modules/articles/read/sql";
import { CLIP_LIST_FEED_ID, CLIP_LIST_FEED_TITLE } from "@modules/articles/write/clips-constants";
import { displayFeedTitle } from "@modules/feeds/read/display-title";
import { DEFAULT_FOLDER_NAME } from "@modules/folders/service";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import type {
  InboxRecapDto,
  InboxRecapFolderDto,
  InboxRecapSavedItemDto,
  InboxRecapTopViewedFeedDto,
} from "./types";

type DB = typeof db;

function normalizeLimit(value: string | number | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return 5;
  }
  return Math.min(Math.max(parsed, 1), 20);
}

export const normalizeRecapLimitForTest = normalizeLimit;

async function listFolderSummaries(
  database: DB,
  userId: string,
): Promise<InboxRecapFolderDto[]> {
  const rows = await database
    .select({
      id: folders.id,
      name: folders.name,
      createdAt: folders.createdAt,
      isPinned: folders.isPinned,
      pinnedAt: folders.pinnedAt,
      feedCount: sql<number>`count(${feedSubscriptions.id})::int`,
    })
    .from(folders)
    .leftJoin(
      feedSubscriptions,
      and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.folderId, folders.id)),
    )
    .where(eq(folders.userId, userId))
    .groupBy(folders.id)
    .orderBy(
      sql`CASE WHEN ${folders.name} = ${DEFAULT_FOLDER_NAME} THEN 0 ELSE 1 END`,
      folders.name,
    );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    isPinned: row.isPinned,
    pinnedAt: row.pinnedAt ? row.pinnedAt.toISOString() : null,
    feedCount: row.feedCount,
  }));
}

async function listTopViewedFeeds(
  database: DB,
  userId: string,
  limit: number,
): Promise<InboxRecapTopViewedFeedDto[]> {
  const rows = await database
    .select({
      feedId: feeds.id,
      url: feeds.url,
      title: feeds.title,
      siteUrl: feeds.link,
      faviconUrl: feeds.faviconUrl,
      viewedItemCount: feedUserStats.viewedItemCount,
      lastViewedAt: feedUserStats.lastViewedAt,
      subscriptionId: feedSubscriptions.id,
      customTitle: feedSubscriptions.customTitle,
      folderId: feedSubscriptions.folderId,
      folderName: folders.name,
    })
    .from(feedUserStats)
    .innerJoin(feeds, eq(feeds.id, feedUserStats.feedId))
    .leftJoin(
      feedSubscriptions,
      and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feeds.id)),
    )
    .leftJoin(folders, eq(folders.id, feedSubscriptions.folderId))
    .where(eq(feedUserStats.userId, userId))
    .orderBy(desc(feedUserStats.viewedItemCount), desc(feedUserStats.lastViewedAt), feeds.title)
    .limit(limit);

  return rows.map((row) => ({
    feedId: row.feedId,
    title: decodeText(displayFeedTitle(row.title, row.customTitle)),
    url: row.url,
    siteUrl: row.siteUrl,
    faviconUrl: row.faviconUrl,
    viewedItemCount: row.viewedItemCount,
    lastViewedAt: row.lastViewedAt.toISOString(),
    isSubscribed: row.subscriptionId !== null,
    folderId: row.folderId,
    folderName: row.folderName,
  }));
}

async function listOldestSavedFeedItems(
  database: DB,
  userId: string,
  limit: number,
): Promise<InboxRecapSavedItemDto[]> {
  const rows = await database
    .select({
      id: feedItems.id,
      title: feedItems.title,
      link: feedItems.link,
      summary: feedItems.summary,
      publishedAt: feedItems.publishedAt,
      feedId: feeds.id,
      feedUrl: feeds.url,
      feedSiteUrl: feeds.link,
      feedTitle: feeds.title,
      feedFaviconUrl: feeds.faviconUrl,
      isRead: articleIsReadSql,
      isSaved: feedItemUserState.isSaved,
      savedAt: feedItemUserState.savedAt,
    })
    .from(feedItemUserState)
    .innerJoin(feedItems, eq(feedItems.id, feedItemUserState.feedItemId))
    .innerJoin(feeds, eq(feeds.id, feedItems.feedId))
    .leftJoin(
      feedSubscriptions,
      and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feeds.id)),
    )
    .where(
      and(
        eq(feedItemUserState.userId, userId),
        eq(feedItemUserState.isSaved, true),
        isNotNull(feedItemUserState.savedAt),
        sql`${feedItemUserState.hiddenAt} IS NULL`,
      ),
    )
    .orderBy(asc(feedItemUserState.savedAt), asc(feedItems.id))
    .limit(limit);

  return rows
    .filter((row): row is typeof row & { savedAt: Date } => row.savedAt !== null)
    .map((row) => ({
      id: row.id,
      title: decodeText(row.title),
      link: row.link,
      summary: decodeNullableText(row.summary),
      publishedAt: row.publishedAt.toISOString(),
      feedId: row.feedId,
      feedUrl: row.feedUrl,
      feedSiteUrl: row.feedSiteUrl,
      feedTitle: decodeText(row.feedTitle),
      feedFaviconUrl: row.feedFaviconUrl,
      isRead: row.isRead,
      isSaved: row.isSaved,
      articleType: "feed" as const,
      savedAt: row.savedAt.toISOString(),
    }));
}

async function listOldestSavedClips(
  database: DB,
  userId: string,
  limit: number,
): Promise<InboxRecapSavedItemDto[]> {
  const rows = await database
    .select()
    .from(articleClips)
    .where(
      and(eq(articleClips.userId, userId), eq(articleClips.isSaved, true), isNotNull(articleClips.savedAt)),
    )
    .orderBy(asc(articleClips.savedAt), asc(articleClips.id))
    .limit(limit);

  return rows
    .filter((row): row is typeof row & { savedAt: Date } => row.savedAt !== null)
    .map((row) => ({
      id: row.id,
      title: decodeText(row.title),
      link: row.url,
      summary: decodeNullableText(row.note),
      publishedAt: row.createdAt.toISOString(),
      feedId: CLIP_LIST_FEED_ID,
      feedUrl: row.url,
      feedSiteUrl: null,
      feedTitle: CLIP_LIST_FEED_TITLE,
      feedFaviconUrl: null,
      isRead: row.isRead,
      isSaved: row.isSaved,
      articleType: "clip" as const,
      savedAt: row.savedAt.toISOString(),
    }));
}

async function listOldestSavedItems(
  database: DB,
  userId: string,
  limit: number,
): Promise<InboxRecapSavedItemDto[]> {
  const [feedItemsPage, clipsPage] = await Promise.all([
    listOldestSavedFeedItems(database, userId, limit),
    listOldestSavedClips(database, userId, limit),
  ]);

  return [...feedItemsPage, ...clipsPage]
    .sort((left, right) => {
      const savedDiff = Date.parse(left.savedAt) - Date.parse(right.savedAt);
      if (savedDiff !== 0) {
        return savedDiff;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

export async function getInboxRecap(
  database: DB,
  userId: string,
  rawLimit?: string | number,
): Promise<InboxRecapDto> {
  const limit = normalizeLimit(rawLimit);
  const [folderSummaries, topViewedFeeds, oldestSavedItems] = await Promise.all([
    listFolderSummaries(database, userId),
    listTopViewedFeeds(database, userId, limit),
    listOldestSavedItems(database, userId, limit),
  ]);

  return {
    folders: folderSummaries,
    topViewedFeeds,
    oldestSavedItems,
  };
}
