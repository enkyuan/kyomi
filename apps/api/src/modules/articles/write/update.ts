import { Effect } from "effect";
import { enqueueEnrichmentForStoredDocument } from "@modules/articles/document/enrich";
import {
  articleClips,
  articleViewEvents,
  feedItemUserState,
  feedItems,
  feedUserStats,
} from "@kyomi/db";
import { and, eq, sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { BadRequest } from "@shared/effect/errors";
import { checkContentFieldBudget } from "@shared/http/budget";
import { currentDate } from "../clock";
import { articleNotFound } from "../errors";
import {
  CLIP_UPDATE_KEYS,
  type ClipUpdateBody,
  updateArticleClipForUser,
} from "./clips/operations";
import { hasAnyOwn, pickOwn, savedAtAfter } from "./fields";
import { compileClientHtml } from "./html";
import type { ArticleUpdateBody } from "../types";

const FEED_STATE_KEYS = ["isRead", "isSaved", "isHidden"] as const;
const FEED_CONTENT_KEYS = [
  "contentHtml",
  "contentText",
  "contentMarkdown",
  "contentStatus",
  "contentSource",
  "extractionErrorCode",
  "extractionErrorMessage",
] as const;
const FEED_UPDATE_KEYS = [
  ...FEED_STATE_KEYS,
  ...FEED_CONTENT_KEYS,
] as const satisfies readonly (keyof ArticleUpdateBody)[];

const getFeedArticleOrFail = Effect.fn("articles.update.find_feed_item")(function* (
  articleId: string,
) {
  const db = yield* Db;
  const [article] = yield* db.use("articles.find_feed_item", (client) =>
    client
      .select({
        id: feedItems.id,
        feedId: feedItems.feedId,
        link: feedItems.link,
        title: feedItems.title,
      })
      .from(feedItems)
      .where(eq(feedItems.id, articleId))
      .limit(1),
  );
  return article ?? (yield* articleNotFound());
});

/** Replaces the stored body fields the update names; client HTML is compiled and re-enriched. */
const updateFeedContent = Effect.fn("articles.update.feed_content")(function* (
  articleId: string,
  article: { link: string; title: string },
  body: ArticleUpdateBody,
  now: Date,
) {
  const db = yield* Db;
  const html = Object.hasOwn(body, "contentHtml")
    ? yield* compileClientHtml(body.contentHtml, { baseUrl: article.link, title: article.title })
    : null;
  yield* db.use("articles.update.feed_content", (client) =>
    client
      .update(feedItems)
      .set({
        ...(html && {
          contentHtml: html.contentHtml,
          contentRaw: html.contentRaw,
          contentSanitizerVersion: html.contentSanitizerVersion,
          ...html.documentColumns,
        }),
        contentText: Object.hasOwn(body, "contentText") ? body.contentText : undefined,
        contentMarkdown: Object.hasOwn(body, "contentMarkdown") ? body.contentMarkdown : undefined,
        contentStatus: Object.hasOwn(body, "contentStatus") ? body.contentStatus : undefined,
        contentSource: Object.hasOwn(body, "contentSource") ? body.contentSource : undefined,
        extractionErrorCode: Object.hasOwn(body, "extractionErrorCode")
          ? body.extractionErrorCode
          : undefined,
        extractionErrorMessage: Object.hasOwn(body, "extractionErrorMessage")
          ? body.extractionErrorMessage
          : undefined,
        updatedAt: now,
      })
      .where(eq(feedItems.id, articleId)),
  );
  if (html) {
    yield* enqueueEnrichmentForStoredDocument({
      table: "feed_items",
      id: articleId,
      body: "original",
    });
  }
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
  const hasContentFields = hasAnyOwn(body, FEED_CONTENT_KEYS);
  const hasStateFields = hasAnyOwn(body, FEED_STATE_KEYS);
  if (!hasStateFields && !hasContentFields) {
    return yield* new BadRequest({
      message: "No updatable fields provided",
      code: "EMPTY_UPDATE",
    });
  }
  yield* checkContentFieldBudget([
    { name: "contentHtml", value: body.contentHtml },
    { name: "contentText", value: body.contentText },
    { name: "contentMarkdown", value: body.contentMarkdown },
  ]);

  const article = yield* getFeedArticleOrFail(articleId);
  const now = yield* currentDate;
  if (hasContentFields) {
    yield* updateFeedContent(articleId, article, body, now);
  }
  if (hasStateFields) {
    yield* updateFeedState(userId, articleId, body, now);
  }
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
    return yield* updateArticleForUser(
      userId,
      articleId,
      pickOwn<ArticleUpdateBody>(raw, FEED_UPDATE_KEYS),
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
