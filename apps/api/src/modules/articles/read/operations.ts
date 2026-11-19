import { Effect } from "effect";
import { AppConfig } from "@config/env/service";
import { withNegotiatedDocuments } from "@modules/articles/document/serve";
import { parseOptionalIsoDate, type ParsedListQuery } from "../params";
import {
  countFeedArticlesPublishedInRange,
  countGlobalFeedArticlesPublishedInRange,
  getArticleCounts,
  getGlobalArticleCounts,
  getUnreadCountsPerFeed,
} from "./counts";
import { getArticleDetail } from "./detail";
import { listClips } from "./list/clips";
import { listArticles } from "./list/query";

/** `GET /articles`: feed items, or the user's clips when `source=clips`. */
export const readArticlesPage = (userId: string, parsed: ParsedListQuery) =>
  parsed.source === "clips"
    ? listClips(userId, {
        limit: parsed.limit,
        cursor: parsed.cursor,
        isRead: parsed.isRead,
        isSaved: parsed.isSaved,
        publishedAfter: parsed.publishedAfter,
        publishedBefore: parsed.publishedBefore,
        sort: parsed.sort,
      })
    : listArticles(userId, {
        limit: parsed.limit,
        cursor: parsed.cursor,
        search: parsed.search,
        feedId: parsed.feedId,
        folderId: parsed.folderId,
        isRead: parsed.isRead,
        isSaved: parsed.isSaved,
        publishedAfter: parsed.publishedAfter,
        publishedBefore: parsed.publishedBefore,
        sort: parsed.sort,
      });

/** `GET /articles/clips`: the user's clips with the basic list filters only. */
export const readClipsPage = (userId: string, parsed: ParsedListQuery) =>
  listClips(userId, {
    limit: parsed.limit,
    cursor: parsed.cursor,
    isRead: parsed.isRead,
    isSaved: parsed.isSaved,
  });

export type CountsQuery = {
  view?: string;
  published_after?: string;
  published_before?: string;
  feed_id?: string;
  folder_id?: string;
};

/**
 * `GET /articles/counts`: `all`/`unread`/`saved`, plus `today` when both bounds of the day are
 * supplied. The global `all` view (no feed or folder) counts every feed item, not just subscribed.
 */
export const readCounts = Effect.fn("articles.counts.read")(function* (
  userId: string,
  query: CountsQuery,
) {
  const scope = {
    feedId: typeof query.feed_id === "string" ? query.feed_id : undefined,
    folderId: typeof query.folder_id === "string" ? query.folder_id : undefined,
  };
  const publishedAfter = parseOptionalIsoDate(query.published_after);
  const publishedBefore = parseOptionalIsoDate(query.published_before);
  const global = query.view === "all" && !scope.feedId?.trim() && !scope.folderId?.trim();

  const today =
    publishedAfter && publishedBefore
      ? global
        ? countGlobalFeedArticlesPublishedInRange(userId, publishedAfter, publishedBefore)
        : countFeedArticlesPublishedInRange(userId, publishedAfter, publishedBefore, scope)
      : Effect.succeed(null);
  const [base, todayCount] = yield* Effect.all(
    [global ? getGlobalArticleCounts(userId, scope) : getArticleCounts(userId, scope), today],
    { concurrency: 2 },
  );
  return todayCount === null ? base : { ...base, today: todayCount };
});

/** `GET /articles/unread-counts`: `feedIds` is the raw comma-separated `feed_ids` parameter. */
export const readUnreadCounts = (userId: string, feedIds: string) =>
  getUnreadCountsPerFeed(
    userId,
    feedIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );

/** `GET /articles/:articleId`, with the stored document negotiated for the client's version. */
export const readArticleDetail = Effect.fn("articles.detail.read")(function* (
  userId: string,
  articleId: string,
  maxDocumentVersion: number,
) {
  const config = yield* AppConfig;
  const article = yield* getArticleDetail(userId, articleId);
  return yield* withNegotiatedDocuments(article, {
    enabled: config.FEATURE_READER_DOCUMENT,
    maxVersion: maxDocumentVersion,
  });
});
