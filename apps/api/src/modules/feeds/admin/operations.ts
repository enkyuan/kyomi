import { Effect } from "effect";
import { and, eq, ne } from "drizzle-orm";
import { feeds } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { FeedSearch, type FeedSearchError } from "@adapters/search/service";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "@modules/discover/feed/normalize";
import { currentDate } from "@shared/effect/clock";
import { BadRequest, Conflict } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";
import { emptyUpdate, feedNotFound } from "../errors";
import type { AdminGlobalFeedDetailDto, AdminUpdateGlobalFeedBody } from "../types";
import { requireFeedAdmin } from "./guard";

type FeedRow = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  link: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type FeedUpdates = {
  title?: string;
  description?: string | null;
  link?: string | null;
  url?: string;
  updatedAt: Date;
};

const FEED_COLUMNS = {
  id: feeds.id,
  url: feeds.url,
  title: feeds.title,
  description: feeds.description,
  link: feeds.link,
  createdAt: feeds.createdAt,
  updatedAt: feeds.updatedAt,
};

function mapFeedRow(row: FeedRow): AdminGlobalFeedDetailDto {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    link: row.link,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const getExistingFeed = Effect.fn("feeds.admin.get")(function* (feedId: string) {
  const db = yield* Db;
  const existing = yield* db.use("feeds.admin.get", (client) =>
    client.select(FEED_COLUMNS).from(feeds).where(eq(feeds.id, feedId)).limit(1),
  );
  const current = existing[0];
  if (!current) {
    return yield* feedNotFound();
  }
  return current;
});

/** `link`: trimmed, and blank or null clears it. */
function normalizeLink(link: string | null | undefined): string | null {
  const trimmed = link?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

const invalidFeedUrl = (cause?: unknown) =>
  new BadRequest({ message: "Invalid feed URL", code: "INVALID_FEED_URL", cause });

function normalizePatchedUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return Effect.fail(invalidFeedUrl());
  }
  return Effect.try({
    try: () => normalizeFeedUrl(assertHttpOrHttpsUrl(trimmed).href),
    catch: invalidFeedUrl,
  });
}

const assertNoFeedUrlConflict = Effect.fn("feeds.admin.assert_url_free")(function* (
  feedId: string,
  normalizedUrl: string,
) {
  const db = yield* Db;
  const clash = yield* db.use("feeds.admin.url_conflict", (client) =>
    client
      .select({ id: feeds.id })
      .from(feeds)
      .where(and(eq(feeds.url, normalizedUrl), ne(feeds.id, feedId)))
      .limit(1),
  );
  if (clash[0]) {
    return yield* new Conflict({
      message: "A feed with this URL already exists",
      code: "FEED_URL_CONFLICT",
    });
  }
});

/** Validates the patch fields in a fixed order and returns the columns to write. */
const buildFeedUpdates = Effect.fn("feeds.admin.build_updates")(function* (
  patch: AdminUpdateGlobalFeedBody,
  feedId: string,
  currentUrl: string,
) {
  const updates: FeedUpdates = { updatedAt: yield* currentDate };

  if ("title" in patch) {
    const next = (patch.title ?? "").trim();
    if (next.length === 0) {
      return yield* new BadRequest({
        message: "title cannot be empty",
        code: "INVALID_FEED_TITLE",
      });
    }
    updates.title = next;
  }
  if ("description" in patch) {
    updates.description = patch.description ?? null;
  }
  if ("link" in patch) {
    updates.link = normalizeLink(patch.link);
  }
  if ("url" in patch && patch.url !== undefined) {
    const normalized = yield* normalizePatchedUrl(patch.url);
    if (normalized !== currentUrl) {
      yield* assertNoFeedUrlConflict(feedId, normalized);
      updates.url = normalized;
    }
  }
  return updates;
});

const saveFeedUpdates = Effect.fn("feeds.admin.save")(function* (
  feedId: string,
  updates: FeedUpdates,
) {
  const db = yield* Db;
  const rows = yield* db.use("feeds.admin.save", (client) =>
    client.update(feeds).set(updates).where(eq(feeds.id, feedId)).returning(FEED_COLUMNS),
  );
  const row = rows[0];
  if (!row) {
    return yield* feedNotFound();
  }
  return row;
});

/**
 * Keep the search index in step with a committed feed change. The database write already
 * succeeded, so an index failure must not fail the request, but it leaves the index stale until
 * the next sync: log it with the cause so the drift is visible.
 */
const syncSearchIndex = Effect.fn("feeds.admin.sync_search")(function* (
  operation: "upsert" | "delete",
  feedId: string,
  run: Effect.Effect<void, FeedSearchError>,
) {
  const log = yield* AppLogger;
  yield* run.pipe(
    Effect.catch((error) =>
      log.warn("feeds.admin.search_sync_failed", {
        operation,
        feedId,
        error: serializeError(error),
      }),
    ),
  );
});

export const adminUpdateGlobalFeed = Effect.fn("feeds.admin.update")(function* (
  userId: string,
  headers: Headers,
  feedId: string,
  patch: AdminUpdateGlobalFeedBody,
) {
  const search = yield* FeedSearch;
  const log = yield* AppLogger;
  yield* requireFeedAdmin(userId, headers);
  if (!("title" in patch || "description" in patch || "link" in patch || "url" in patch)) {
    return yield* emptyUpdate();
  }
  const current = yield* getExistingFeed(feedId);
  const updates = yield* buildFeedUpdates(patch, feedId, current.url);
  const row = yield* saveFeedUpdates(feedId, updates);

  yield* syncSearchIndex(
    "upsert",
    row.id,
    search.upsert([
      {
        id: row.id,
        url: row.url,
        title: row.title,
        description: row.description,
        link: row.link,
      },
    ]),
  );

  yield* log.info("feeds.admin.updated", { userId, feedId });
  return mapFeedRow(row);
});

export const adminDeleteGlobalFeed = Effect.fn("feeds.admin.delete")(function* (
  userId: string,
  headers: Headers,
  feedId: string,
) {
  const db = yield* Db;
  const search = yield* FeedSearch;
  const log = yield* AppLogger;
  yield* requireFeedAdmin(userId, headers);
  const removed = yield* db.use("feeds.admin.delete", (client) =>
    client.delete(feeds).where(eq(feeds.id, feedId)).returning({ id: feeds.id }),
  );
  if (removed.length === 0) {
    return yield* feedNotFound();
  }
  yield* syncSearchIndex("delete", feedId, search.remove(feedId));
  yield* log.info("feeds.admin.deleted", { userId, feedId });
  return { message: "Feed deleted" };
});
