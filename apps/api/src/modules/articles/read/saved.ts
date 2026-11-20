import { Effect } from "effect";
import { articleClips, feedItems, feedItemUserState, feedSubscriptions } from "@kyomi/db";
import { and, desc, eq } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { BadRequest } from "@shared/effect/errors";
import type { ArticleSavedCheckDto } from "../types";

/**
 * Whether the user has saved `rawUrl`, as a clip first and otherwise as a subscribed feed item.
 * A blank url fails with `ARTICLE_URL_REQUIRED`.
 */
export const checkSavedArticle = Effect.fn("articles.checkSaved")(function* (
  userId: string,
  rawUrl: string,
) {
  const url = rawUrl.trim();
  if (!url) {
    return yield* new BadRequest({ message: "url is required", code: "ARTICLE_URL_REQUIRED" });
  }
  const db = yield* Db;

  const [clip] = yield* db.use("articles.checkSaved.clip", (client) =>
    client
      .select({ id: articleClips.id, title: articleClips.title, url: articleClips.url })
      .from(articleClips)
      .where(
        and(
          eq(articleClips.userId, userId),
          eq(articleClips.url, url),
          eq(articleClips.isSaved, true),
        ),
      )
      .orderBy(desc(articleClips.updatedAt), desc(articleClips.id))
      .limit(1),
  );
  if (clip) {
    return {
      is_saved: true,
      article: { id: clip.id, title: clip.title, url: clip.url, articleType: "clip" },
    } satisfies ArticleSavedCheckDto;
  }

  const [feedItem] = yield* db.use("articles.checkSaved.feed", (client) =>
    client
      .select({ id: feedItems.id, title: feedItems.title, url: feedItems.link })
      .from(feedItems)
      .innerJoin(
        feedSubscriptions,
        and(eq(feedSubscriptions.feedId, feedItems.feedId), eq(feedSubscriptions.userId, userId)),
      )
      .innerJoin(
        feedItemUserState,
        and(eq(feedItemUserState.feedItemId, feedItems.id), eq(feedItemUserState.userId, userId)),
      )
      .where(and(eq(feedItems.link, url), eq(feedItemUserState.isSaved, true)))
      .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
      .limit(1),
  );
  if (feedItem) {
    return {
      is_saved: true,
      article: { id: feedItem.id, title: feedItem.title, url: feedItem.url, articleType: "feed" },
    } satisfies ArticleSavedCheckDto;
  }

  return { is_saved: false, article: null } satisfies ArticleSavedCheckDto;
});
