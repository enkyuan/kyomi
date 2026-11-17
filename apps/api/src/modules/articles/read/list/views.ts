import { Effect } from "effect";
import { currentDate } from "@modules/articles/clock";
import { Db } from "@adapters/db/service";
import type { ArticleSort } from "@modules/articles/params";
import { attachReadingProgress } from "@modules/articles/progress/read";
import { listClips } from "./clips";
import { decodeMergedListCursor, decodeRecentViewCursor } from "./cursor";
import { mergeArticleListsSorted, mergedFeedClipResponsePaged } from "./merge";
import { listArticles } from "./query";
import {
  listRecentlyViewedClipItems,
  listRecentlyViewedFeedItems,
  mergedRecentlyViewedResponsePaged,
  mergeRecentlyViewedItemsSorted,
} from "./recent";
import { utcDayRange } from "./window";

/** Each source is asked for more than a page so the merge can fill it from either side. */
function perSourceFetchLimit(responseLimit: number) {
  return Math.min(200, Math.max(responseLimit * 2, responseLimit));
}

/** Feed + clip merge of the same filters: the two sources are read concurrently. */
const mergedPage = Effect.fn("articles.views.merged")(function* (
  userId: string,
  limit: number,
  cursor: string | undefined,
  sort: ArticleSort,
  filters: { isSaved?: boolean; publishedAfter?: Date; publishedBefore?: Date },
) {
  const boundary = yield* decodeMergedListCursor(cursor);
  const options = {
    limit: perSourceFetchLimit(limit),
    ...filters,
    exclusiveBefore: boundary,
    sort,
  };
  const [feed, clips] = yield* Effect.all(
    [listArticles(userId, options), listClips(userId, options)],
    { concurrency: 2 },
  );
  const mergedSorted = mergeArticleListsSorted([feed.items, clips.items], sort);
  return mergedFeedClipResponsePaged(mergedSorted, limit, feed.has_more, clips.has_more, sort);
});

/** Items published today (UTC), feeds and clips merged. */
export const listMergedTodayView = Effect.fn("articles.views.today")(function* (
  userId: string,
  limit: number,
  cursor?: string,
  sort: ArticleSort = "latest",
) {
  const { start, end } = utcDayRange(yield* currentDate);
  return yield* mergedPage(userId, limit, cursor, sort, {
    publishedAfter: start,
    publishedBefore: end,
  });
});

/** Saved ("read later") items, feeds and clips merged. */
export const listMergedSavedView = Effect.fn("articles.views.saved")(function* (
  userId: string,
  limit: number,
  cursor?: string,
  sort: ArticleSort = "latest",
) {
  return yield* mergedPage(userId, limit, cursor, sort, { isSaved: true });
});

/** Items the user opened, most recently viewed first, feeds and clips merged. */
export const listMergedRecentlyReadView = Effect.fn("articles.views.recent")(function* (
  userId: string,
  limit: number,
  cursor?: string,
  sort: ArticleSort = "latest",
  search?: string,
) {
  const db = yield* Db;
  const boundary = yield* decodeRecentViewCursor(cursor);
  const query = { userId, limit: perSourceFetchLimit(limit), boundary, sort, search };
  const [feed, clips] = yield* Effect.all(
    [listRecentlyViewedFeedItems(query), listRecentlyViewedClipItems(query)],
    { concurrency: 2 },
  );
  const [feedItemsWithProgress, clipItemsWithProgress] = yield* Effect.all(
    [
      db.use("articles.recent.progress.feed", (client) =>
        attachReadingProgress(client, userId, feed.items),
      ),
      db.use("articles.recent.progress.clips", (client) =>
        attachReadingProgress(client, userId, clips.items),
      ),
    ],
    { concurrency: 2 },
  );
  const mergedSorted = mergeRecentlyViewedItemsSorted(
    [...feedItemsWithProgress, ...clipItemsWithProgress],
    sort,
  );
  return mergedRecentlyViewedResponsePaged(mergedSorted, limit, feed.hasMore, clips.hasMore, sort);
});
