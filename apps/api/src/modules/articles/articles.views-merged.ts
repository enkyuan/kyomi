import type { db } from "@adapters/db/client";
import { listClipsForUser } from "./articles.clips";
import { mergeArticleItemsByDate, mergedFeedClipResponse } from "./articles.merge";
import { listArticlesForUser } from "./articles.list";

type DB = typeof db;

function utcDayRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function listMergedTodayView(database: DB, userId: string, limit: number) {
  const { start, end } = utcDayRange();
  const [feed, clips] = await Promise.all([
    listArticlesForUser(database, userId, {
      limit: 120,
      publishedAfter: start,
      publishedBefore: end,
    }),
    listClipsForUser(database, userId, {
      limit: 120,
      publishedAfter: start,
      publishedBefore: end,
    }),
  ]);
  const totalCount = (feed.total_count ?? feed.items.length) + (clips.total_count ?? clips.items.length);
  return mergedFeedClipResponse(mergeArticleItemsByDate([feed.items, clips.items], limit), totalCount);
}

export async function listMergedRecentlyReadView(database: DB, userId: string, limit: number) {
  const [feed, clips] = await Promise.all([
    listArticlesForUser(database, userId, { limit: 120, isRead: true }),
    listClipsForUser(database, userId, { limit: 120, isRead: true }),
  ]);
  const totalCount = (feed.total_count ?? feed.items.length) + (clips.total_count ?? clips.items.length);
  return mergedFeedClipResponse(mergeArticleItemsByDate([feed.items, clips.items], limit), totalCount);
}

export async function listMergedSavedView(database: DB, userId: string, limit: number) {
  const [feed, clips] = await Promise.all([
    listArticlesForUser(database, userId, { limit: 120, isSaved: true }),
    listClipsForUser(database, userId, { limit: 120, isSaved: true }),
  ]);
  const totalCount = (feed.total_count ?? feed.items.length) + (clips.total_count ?? clips.items.length);
  return mergedFeedClipResponse(mergeArticleItemsByDate([feed.items, clips.items], limit), totalCount);
}
