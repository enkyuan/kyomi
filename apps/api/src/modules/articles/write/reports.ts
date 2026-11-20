import { Effect } from "effect";
import { articleClips, articleReports, feedItems, feedSubscriptions, feeds } from "@kyomi/db";
import { and, eq } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { articleNotFound } from "../errors";
import type { BrokenArticleReportBody } from "../types";

function normalizeDetails(details: string | null | undefined): string | null {
  const trimmed = details?.trim();
  return trimmed ? trimmed.slice(0, 4000) : null;
}

/** Reports one of the user's own clips, or any feed article in a feed the user subscribes to. */
export const createBrokenArticleReport = Effect.fn("articles.report.create")(function* (
  userId: string,
  articleId: string,
  body: BrokenArticleReportBody,
) {
  const db = yield* Db;
  const reason = body.reason ?? "broken_article";
  const details = normalizeDetails(body.details);

  const [clip] = yield* db.use("articles.report.find_clip", (client) =>
    client
      .select({ id: articleClips.id, title: articleClips.title, url: articleClips.url })
      .from(articleClips)
      .where(and(eq(articleClips.id, articleId), eq(articleClips.userId, userId)))
      .limit(1),
  );

  if (clip) {
    yield* db.use("articles.report.insert_clip", (client) =>
      client.insert(articleReports).values({
        id: crypto.randomUUID(),
        userId,
        articleId,
        articleType: "clip",
        clipId: clip.id,
        reason,
        details,
        articleTitle: clip.title,
        articleUrl: clip.url,
        feedTitle: null,
        feedUrl: null,
      }),
    );
    return;
  }

  const [feedArticle] = yield* db.use("articles.report.find_feed_item", (client) =>
    client
      .select({
        id: feedItems.id,
        title: feedItems.title,
        url: feedItems.link,
        feedTitle: feeds.title,
        feedUrl: feeds.url,
      })
      .from(feedItems)
      .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
      .innerJoin(
        feedSubscriptions,
        and(eq(feedSubscriptions.feedId, feedItems.feedId), eq(feedSubscriptions.userId, userId)),
      )
      .where(eq(feedItems.id, articleId))
      .limit(1),
  );

  if (!feedArticle) {
    return yield* articleNotFound();
  }

  yield* db.use("articles.report.insert_feed_item", (client) =>
    client.insert(articleReports).values({
      id: crypto.randomUUID(),
      userId,
      articleId,
      articleType: "feed",
      feedItemId: feedArticle.id,
      reason,
      details,
      articleTitle: feedArticle.title,
      articleUrl: feedArticle.url,
      feedTitle: feedArticle.feedTitle,
      feedUrl: feedArticle.feedUrl,
    }),
  );
});
