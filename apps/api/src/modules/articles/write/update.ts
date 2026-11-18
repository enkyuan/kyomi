import { Effect } from "effect";
import {
  articleClips,
  articleViewEvents,
  feedItemUserState,
  feedItems,
  feedUserStats,
} from "@kyomi/db";
import { and, eq, sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { BadRequest, Forbidden } from "@shared/effect/errors";
import { currentDate } from "@shared/effect/clock";
import { articleNotFound } from "../errors";
import {
  CLIP_UPDATE_KEYS,
  type ClipUpdateBody,
  updateArticleClipForUser,
} from "./clips/operations";
import { hasAnyOwn, pickOwn, savedAtAfter } from "./fields";
import type { ArticleUpdateBody } from "../types";

/**
 * What a feed item accepts. `feed_items` rows are shared by every subscriber, so a user may only
 * change their own read, saved and hidden state; the stored body is written by ingestion alone.
 */
const FEED_STATE_KEYS = [
  "isRead",
  "isSaved",
  "isHidden",
] as const satisfies readonly (keyof ArticleUpdateBody)[];
/** Body and extraction fields a clip owner may set on their own clip, never on a feed item. */
const CONTENT_KEYS = [
  "contentHtml",
  "contentText",
  "contentMarkdown",
  "contentStatus",
  "contentSource",
  "extractionErrorCode",
  "extractionErrorMessage",
] as const;

const getFeedArticleOrFail = Effect.fn("articles.update.find_feed_item")(function* (
  articleId: string,
) {
  const db = yield* Db;
  const [article] = yield* db.use("articles.find_feed_item", (client) =>
    client
      .select({ id: feedItems.id, feedId: feedItems.feedId })
      .from(feedItems)
      .where(eq(feedItems.id, articleId))
      .limit(1),
  );
  return article ?? (yield* articleNotFound());
});

/** Merges the read, saved and hidden flags the update names over the user's stored state. */
const updateFeedState = Effect.fn("articles.update.feed_state")(function* (
  userId: string,
  articleId: string,
  body: ArticleUpdateBody,
  now: Date,
) {
  const db = yield* Db;
  const [prev] = yield* db.use("articles.update.feed_state_read", (client) =>
    client
      .select({
        readOverride: feedItemUserState.readOverride,
        isSaved: feedItemUserState.isSaved,
        savedAt: feedItemUserState.savedAt,
        hiddenAt: feedItemUserState.hiddenAt,
      })
      .from(feedItemUserState)
      .where(and(eq(feedItemUserState.userId, userId), eq(feedItemUserState.feedItemId, articleId)))
      .limit(1),
  );

  const hasSaved = Object.hasOwn(body, "isSaved");
  const readOverride = Object.hasOwn(body, "isRead") ? body.isRead! : (prev?.readOverride ?? null);
  const isSaved = hasSaved ? body.isSaved! : (prev?.isSaved ?? false);
  const savedAt = savedAtAfter(prev?.savedAt ?? null, hasSaved ? body.isSaved : undefined, now);
  const hiddenAt = Object.hasOwn(body, "isHidden")
    ? body.isHidden
      ? now
      : null
    : (prev?.hiddenAt ?? null);

  yield* db.use("articles.update.feed_state_write", (client) =>
    client
      .insert(feedItemUserState)
      .values({
        userId,
        feedItemId: articleId,
        readOverride,
        isSaved,
        savedAt,
        hiddenAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [feedItemUserState.userId, feedItemUserState.feedItemId],
        set: { readOverride, isSaved, savedAt, hiddenAt, updatedAt: now },
      }),
  );
});

export const updateArticleForUser = Effect.fn("articles.update.feed")(function* (
  userId: string,
  articleId: string,
  body: ArticleUpdateBody,
) {
  if (!hasAnyOwn(body, FEED_STATE_KEYS)) {
    return yield* new BadRequest({
      message: "No updatable fields provided",
      code: "EMPTY_UPDATE",
    });
  }

  yield* getFeedArticleOrFail(articleId);
  yield* updateFeedState(userId, articleId, body, yield* currentDate);
});

/**
 * Records one open of an article: the view event, the per-user last-viewed time, and the per-feed
 * viewed counter (incremented only on the first view of a feed item).
 */
export const recordArticleViewForUser = Effect.fn("articles.view.record")(function* (
  userId: string,
  articleId: string,
) {
  const db = yield* Db;
  const now = yield* currentDate;

  const [updatedClip] = yield* db.use("articles.view.touch_clip", (client) =>
    client
      .update(articleClips)
      .set({ lastViewedAt: now, updatedAt: now })
      .where(and(eq(articleClips.id, articleId), eq(articleClips.userId, userId)))
      .returning({ id: articleClips.id }),
  );

  if (updatedClip) {
    yield* db.use("articles.view.event_clip", (client) =>
      client.insert(articleViewEvents).values({
        id: crypto.randomUUID(),
        userId,
        clipId: articleId,
        articleType: "clip",
        isFirstView: false,
        viewedAt: now,
      }),
    );
    return;
  }

  const article = yield* getFeedArticleOrFail(articleId);
  const [insertedState] = yield* db.use("articles.view.insert_state", (client) =>
    client
      .insert(feedItemUserState)
      .values({
        userId,
        feedItemId: articleId,
        readOverride: null,
        isSaved: false,
        lastViewedAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning({ feedItemId: feedItemUserState.feedItemId }),
  );

  let isFirstView = Boolean(insertedState);
  if (!isFirstView) {
    const [firstViewedState] = yield* db.use("articles.view.first_view_state", (client) =>
      client
        .update(feedItemUserState)
        .set({ lastViewedAt: now, updatedAt: now })
        .where(
          and(
            eq(feedItemUserState.userId, userId),
            eq(feedItemUserState.feedItemId, articleId),
            sql`${feedItemUserState.lastViewedAt} IS NULL`,
          ),
        )
        .returning({ feedItemId: feedItemUserState.feedItemId }),
    );

    isFirstView = Boolean(firstViewedState);
    if (!isFirstView) {
      yield* db.use("articles.view.touch_state", (client) =>
        client
          .update(feedItemUserState)
          .set({ lastViewedAt: now, updatedAt: now })
          .where(
            and(eq(feedItemUserState.userId, userId), eq(feedItemUserState.feedItemId, articleId)),
          ),
      );
    }
  }

  yield* db.use("articles.view.event_feed_item", (client) =>
    client.insert(articleViewEvents).values({
      id: crypto.randomUUID(),
      userId,
      feedItemId: articleId,
      feedId: article.feedId,
      articleType: "feed",
      isFirstView,
      viewedAt: now,
    }),
  );

  const firstStats = {
    userId,
    feedId: article.feedId,
    viewedItemCount: 1,
    lastViewedAt: now,
    updatedAt: now,
  };

  if (isFirstView) {
    yield* db.use("articles.view.stats_increment", (client) =>
      client
        .insert(feedUserStats)
        .values(firstStats)
        .onConflictDoUpdate({
          target: [feedUserStats.userId, feedUserStats.feedId],
          set: {
            viewedItemCount: sql`${feedUserStats.viewedItemCount} + 1`,
            lastViewedAt: now,
            updatedAt: now,
          },
        }),
    );
    return;
  }

  const [updatedStats] = yield* db.use("articles.view.stats_touch", (client) =>
    client
      .update(feedUserStats)
      .set({ lastViewedAt: now, updatedAt: now })
      .where(and(eq(feedUserStats.userId, userId), eq(feedUserStats.feedId, article.feedId)))
      .returning({ feedId: feedUserStats.feedId }),
  );

  if (!updatedStats) {
    yield* db.use("articles.view.stats_backfill", (client) =>
      client
        .insert(feedUserStats)
        .values(firstStats)
        .onConflictDoUpdate({
          target: [feedUserStats.userId, feedUserStats.feedId],
          set: { lastViewedAt: now, updatedAt: now },
        }),
    );
  }
});

/**
 * `PUT /articles/:articleId`: the article is either one of the user's clips (clip rules: no hide,
 * title and note editable) or a feed item (per-user state plus optional content replacement).
 */
export const updateArticleOrClipForUser = Effect.fn("articles.update")(function* (
  userId: string,
  articleId: string,
  raw: Record<string, unknown>,
) {
  const db = yield* Db;
  const [clip] = yield* db.use("articles.update.find_clip", (client) =>
    client
      .select({ id: articleClips.id })
      .from(articleClips)
      .where(and(eq(articleClips.id, articleId), eq(articleClips.userId, userId)))
      .limit(1),
  );

  if (!clip) {
    if (hasAnyOwn(raw, CONTENT_KEYS)) {
      return yield* new Forbidden({
        message: "Only a clip's owner can change its content",
        code: "ARTICLE_CONTENT_READ_ONLY",
      });
    }
    return yield* updateArticleForUser(
      userId,
      articleId,
      pickOwn<ArticleUpdateBody>(raw, FEED_STATE_KEYS),
    );
  }
  if (Object.hasOwn(raw, "isHidden")) {
    return yield* new BadRequest({
      message: "Clips cannot be hidden from feed views",
      code: "CLIP_HIDE_UNSUPPORTED",
    });
  }
  yield* updateArticleClipForUser(
    userId,
    articleId,
    pickOwn<ClipUpdateBody>(raw, CLIP_UPDATE_KEYS),
  );
});
