import { and, eq, inArray, or, sql } from "drizzle-orm";
import { feedItems, feeds, feedSubscriptions, opmlImportItems, opmlImports } from "@kyomi/db";
import type { db } from "@adapters/db/client";
import { enqueueFeedRefresh } from "@modules/feeds/refresh/enqueue";
import { OPML_MATERIALIZE_CHUNK_SIZE } from "./constants";

type DB = typeof db;
type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function rowsFromExecute<T>(result: unknown): T[] {
  if (Array.isArray(result)) {
    return result as T[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

type PendingItem = { id: string; normalizedUrl: string };
type FeedAlias = {
  id: string;
  url: string;
  submittedUrl: string | null;
  canonicalFeedUrl: string | null;
};

function pickBestFeedMatch(normalizedUrl: string, candidates: FeedAlias[]): FeedAlias | null {
  const exact = candidates.filter((feed) => feed.url === normalizedUrl);
  const pool = exact.length > 0 ? exact : candidates;
  if (pool.length === 0) {
    return null;
  }
  return [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0] ?? null;
}

async function matchPendingBatch(database: DB, batch: PendingItem[]): Promise<number> {
  if (batch.length === 0) {
    return 0;
  }
  const urls = batch.map((item) => item.normalizedUrl);
  const candidates = await database
    .select({
      id: feeds.id,
      url: feeds.url,
      submittedUrl: feeds.submittedUrl,
      canonicalFeedUrl: feeds.canonicalFeedUrl,
    })
    .from(feeds)
    .where(
      or(
        inArray(feeds.url, urls),
        inArray(feeds.submittedUrl, urls),
        inArray(feeds.canonicalFeedUrl, urls),
      ),
    );

  const matches: Array<{ itemId: string; feedId: string }> = [];
  for (const item of batch) {
    const aliasMatches = candidates.filter(
      (feed) =>
        feed.url === item.normalizedUrl ||
        feed.submittedUrl === item.normalizedUrl ||
        feed.canonicalFeedUrl === item.normalizedUrl,
    );
    const best = pickBestFeedMatch(item.normalizedUrl, aliasMatches);
    if (best) {
      matches.push({ itemId: item.id, feedId: best.id });
    }
  }
  if (matches.length === 0) {
    return 0;
  }

  // One batched UPDATE...FROM(VALUES) statement instead of one round-trip per matched item --
  // at up to 500 matches per chunk, a per-row loop here was the dominant cost at 50K scale.
  const now = new Date();
  const updated = await database.execute(sql`
    UPDATE ${opmlImportItems} item
    SET feed_id = v.feed_id, updated_at = ${now}
    FROM (VALUES ${sql.join(
      matches.map((m) => sql`(${m.itemId}, ${m.feedId})`),
      sql`, `,
    )}) AS v(item_id, feed_id)
    WHERE item.id = v.item_id AND item.status = 'pending'
    RETURNING item.id
  `);
  return rowsFromExecute<{ id: string }>(updated).length;
}

/**
 * Matches pending import items against existing feeds by normalizedUrl, without any remote
 * discovery: exact feeds.url first, then submittedUrl/canonicalFeedUrl aliases. Processes at
 * most OPML_MATERIALIZE_CHUNK_SIZE items per statement and returns how many items were matched.
 */
export async function matchKnownFeedsForImport(database: DB, importId: string): Promise<number> {
  const pending = await database
    .select({ id: opmlImportItems.id, normalizedUrl: opmlImportItems.normalizedUrl })
    .from(opmlImportItems)
    .where(and(eq(opmlImportItems.importId, importId), eq(opmlImportItems.status, "pending")));

  let matched = 0;
  for (const batch of chunk(pending, OPML_MATERIALIZE_CHUNK_SIZE)) {
    matched += await matchPendingBatch(database, batch);
  }
  return matched;
}

export type KnownFeedCompletion = {
  processed: number;
  subscribed: number;
  alreadySubscribed: number;
  refreshCandidateFeedIds: string[];
};

const EMPTY_COMPLETION: KnownFeedCompletion = {
  processed: 0,
  subscribed: 0,
  alreadySubscribed: 0,
  refreshCandidateFeedIds: [],
};

type MatchedItem = {
  id: string;
  feedId: string;
  folderId: string | null;
  title: string | null;
};

async function feedIdsNeedingInitialRefresh(database: DB, feedIds: string[]): Promise<Set<string>> {
  if (feedIds.length === 0) {
    return new Set();
  }
  const refreshedFeeds = await database
    .select({ id: feeds.id })
    .from(feeds)
    .where(and(inArray(feeds.id, feedIds), sql`${feeds.lastRefreshSucceededAt} IS NOT NULL`));
  const alreadyRefreshed = new Set(refreshedFeeds.map((f) => f.id));

  const feedsWithItems = await database
    .select({ feedId: feedItems.feedId })
    .from(feedItems)
    .where(inArray(feedItems.feedId, feedIds));
  const haveItems = new Set(feedsWithItems.map((f) => f.feedId));

  return new Set(feedIds.filter((id) => !alreadyRefreshed.has(id) && !haveItems.has(id)));
}

/**
 * Processes at most OPML_MATERIALIZE_CHUNK_SIZE feedId-matched, still-pending items per
 * transaction. The transaction locks the parent import and only proceeds while it is still
 * parsing, so an observed cancellation blocks the subscription insert entirely. Subscription
 * insertion is bulk and conflict-safe: existing subscriptions are never overwritten.
 */
export async function subscribeKnownOpmlItems(
  database: DB,
  importId: string,
  userId: string,
): Promise<KnownFeedCompletion> {
  const matchedItems = (await database
    .select({
      id: opmlImportItems.id,
      feedId: opmlImportItems.feedId,
      folderId: opmlImportItems.folderId,
      title: opmlImportItems.title,
    })
    .from(opmlImportItems)
    .where(
      and(
        eq(opmlImportItems.importId, importId),
        eq(opmlImportItems.status, "pending"),
        sql`${opmlImportItems.feedId} IS NOT NULL`,
      ),
    )
    .limit(OPML_MATERIALIZE_CHUNK_SIZE)) as MatchedItem[];

  if (matchedItems.length === 0) {
    return EMPTY_COMPLETION;
  }

  return database.transaction(async (tx) => {
    const [parent] = await tx
      .select({ status: opmlImports.status })
      .from(opmlImports)
      .where(eq(opmlImports.id, importId))
      .limit(1);
    if (!parent || parent.status !== "parsing") {
      return EMPTY_COMPLETION;
    }

    const feedIds = matchedItems.map((item) => item.feedId);
    const existingSubs = await tx
      .select({ feedId: feedSubscriptions.feedId })
      .from(feedSubscriptions)
      .where(and(eq(feedSubscriptions.userId, userId), inArray(feedSubscriptions.feedId, feedIds)));
    const alreadySubscribedFeedIds = new Set(existingSubs.map((row) => row.feedId));

    const toInsert = matchedItems.filter((item) => !alreadySubscribedFeedIds.has(item.feedId));
    const insertedFeedIds = new Set<string>();
    const now = new Date();
    for (const insertBatch of chunk(toInsert, OPML_MATERIALIZE_CHUNK_SIZE)) {
      if (insertBatch.length === 0) {
        continue;
      }
      const inserted = await tx
        .insert(feedSubscriptions)
        .values(
          insertBatch.map((item) => ({
            id: crypto.randomUUID(),
            userId,
            feedId: item.feedId,
            folderId: item.folderId,
            customTitle: item.title,
            createdAt: now,
          })),
        )
        .onConflictDoNothing()
        .returning({ feedId: feedSubscriptions.feedId });
      for (const row of inserted) {
        insertedFeedIds.add(row.feedId);
      }
    }

    let subscribed = 0;
    let alreadySubscribed = 0;
    const subscribedItemIds: string[] = [];
    const alreadySubscribedItemIds: string[] = [];
    for (const item of matchedItems) {
      if (insertedFeedIds.has(item.feedId)) {
        subscribedItemIds.push(item.id);
      } else {
        alreadySubscribedItemIds.push(item.id);
      }
    }

    if (subscribedItemIds.length > 0) {
      const transitioned = await tx
        .update(opmlImportItems)
        .set({ status: "subscribed", outcomeAt: now, updatedAt: now })
        .where(
          and(
            inArray(opmlImportItems.id, subscribedItemIds),
            eq(opmlImportItems.status, "pending"),
          ),
        )
        .returning({ id: opmlImportItems.id });
      subscribed = transitioned.length;
    }
    if (alreadySubscribedItemIds.length > 0) {
      const transitioned = await tx
        .update(opmlImportItems)
        .set({ status: "already_subscribed", outcomeAt: now, updatedAt: now })
        .where(
          and(
            inArray(opmlImportItems.id, alreadySubscribedItemIds),
            eq(opmlImportItems.status, "pending"),
          ),
        )
        .returning({ id: opmlImportItems.id });
      alreadySubscribed = transitioned.length;
    }

    const processed = subscribed + alreadySubscribed;
    if (processed > 0) {
      await tx
        .update(opmlImports)
        .set({
          completedItems: sql`${opmlImports.completedItems} + ${processed}`,
          subscribedItems: sql`${opmlImports.subscribedItems} + ${subscribed}`,
          alreadySubscribedItems: sql`${opmlImports.alreadySubscribedItems} + ${alreadySubscribed}`,
          updatedAt: now,
        })
        .where(eq(opmlImports.id, importId));
    }

    const refreshCandidates = await feedIdsNeedingInitialRefresh(tx as never, [...insertedFeedIds]);

    return {
      processed,
      subscribed,
      alreadySubscribed,
      refreshCandidateFeedIds: [...refreshCandidates],
    };
  });
}

/** Publishes initial-refresh candidates in sequential chunks of 100; publish failure is logged, never rolled back. */
export async function publishKnownFeedRefreshCandidates(
  database: DB,
  userId: string,
  feedIds: string[],
  logger: Logger,
): Promise<void> {
  for (const batch of chunk(feedIds, 100)) {
    for (const feedId of batch) {
      try {
        await enqueueFeedRefresh(database, feedId, userId, "subscription_created", logger);
      } catch (error) {
        logger.error("opml.import.known_feed.refresh_publish_failed", {
          feedId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
