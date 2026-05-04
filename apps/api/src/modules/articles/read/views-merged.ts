import type { db } from "@adapters/db/client";
import { listClipsForUser } from "../write/clips";
import { mergeArticleListsSortedDesc, mergedFeedClipResponsePaged } from "./merge";
import { decodeMergedListCursor } from "./merged-view-cursor";
import { listArticlesForUser } from "./list";

type DB = typeof db;

function perSourceFetchLimit(responseLimit: number) {
  return Math.min(200, Math.max(responseLimit * 2, responseLimit));
}

function utcDayRange() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function listMergedTodayView(
  database: DB,
  userId: string,
  limit: number,
  cursor?: string,
) {
  const boundary = decodeMergedListCursor(cursor);
  const take = perSourceFetchLimit(limit);
  const { start, end } = utcDayRange();
  const [feed, clips] = await Promise.all([
    listArticlesForUser(database, userId, {
      limit: take,
      publishedAfter: start,
      publishedBefore: end,
      exclusiveBefore: boundary,
    }),
    listClipsForUser(database, userId, {
      limit: take,
      publishedAfter: start,
      publishedBefore: end,
      exclusiveBefore: boundary,
    }),
  ]);
  const mergedSorted = mergeArticleListsSortedDesc([feed.items, clips.items]);
  return mergedFeedClipResponsePaged(mergedSorted, limit, feed.has_more, clips.has_more);
}

export async function listMergedRecentlyReadView(
  database: DB,
  userId: string,
  limit: number,
  cursor?: string,
) {
  const boundary = decodeMergedListCursor(cursor);
  const take = perSourceFetchLimit(limit);
  const [feed, clips] = await Promise.all([
    listArticlesForUser(database, userId, {
      limit: take,
      isRead: true,
      exclusiveBefore: boundary,
    }),
    listClipsForUser(database, userId, {
      limit: take,
      isRead: true,
      exclusiveBefore: boundary,
    }),
  ]);
  const mergedSorted = mergeArticleListsSortedDesc([feed.items, clips.items]);
  return mergedFeedClipResponsePaged(mergedSorted, limit, feed.has_more, clips.has_more);
}

export async function listMergedSavedView(
  database: DB,
  userId: string,
  limit: number,
  cursor?: string,
) {
  const boundary = decodeMergedListCursor(cursor);
  const take = perSourceFetchLimit(limit);
  const [feed, clips] = await Promise.all([
    listArticlesForUser(database, userId, {
      limit: take,
      isSaved: true,
      exclusiveBefore: boundary,
    }),
    listClipsForUser(database, userId, {
      limit: take,
      isSaved: true,
      exclusiveBefore: boundary,
    }),
  ]);
  const mergedSorted = mergeArticleListsSortedDesc([feed.items, clips.items]);
  return mergedFeedClipResponsePaged(mergedSorted, limit, feed.has_more, clips.has_more);
}
