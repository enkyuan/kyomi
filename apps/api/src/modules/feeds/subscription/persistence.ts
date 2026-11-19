import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { feedSubscriptions, feeds } from "@kyomi/db";
import { faviconSourceRank } from "@kyomi/ingest/favicon";
import { Db, type Database } from "@adapters/db/service";
import type { ResolvedRemoteFeed } from "@modules/discover/feed/resolve/remote";
import { DEFAULT_FOLDER_NAME, getOrCreateFolderByName } from "@modules/folders/operations";
import { isApiError, type ApiError, type DatabaseError } from "@shared/effect/errors";

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Run Promise-based Drizzle work in one transaction. A throw rolls it back and becomes a typed
 * `DatabaseError`, except a catalogue error the callback rejects with (the folders domain's
 * `FOLDER_CREATE_FAILED`, say), which is handed back as itself so it keeps its status and code.
 */
export function inTransaction<A>(operation: string, run: (tx: Transaction) => Promise<A>) {
  return Effect.gen(function* () {
    const db = yield* Db;
    return yield* db
      .use(operation, (client) => client.transaction(run))
      .pipe(
        Effect.mapError(
          (error: DatabaseError): ApiError => (isApiError(error.cause) ? error.cause : error),
        ),
      );
  });
}

export type FaviconEnrichment = { url: string; source: string } | null;

type UpsertedFeed = {
  feedId: string;
  newFeed: boolean;
  faviconUrl: string | null;
  faviconSource: string | null;
};

type ExistingFeed = {
  id: string;
  link: string | null;
  submittedUrl: string | null;
  discoveredFromUrl: string | null;
  discoveryProvenance: string | null;
  faviconUrl: string | null;
  faviconSource: string | null;
};

/** A resolved favicon replaces the stored one when none is stored, the site moved, or it ranks higher. */
function shouldApplyFavicon(
  existing: ExistingFeed,
  resolved: ResolvedRemoteFeed,
  favicon: FaviconEnrichment,
): favicon is NonNullable<FaviconEnrichment> {
  if (!favicon) {
    return false;
  }
  const linkChanged = (existing.link ?? "") !== (resolved.link ?? "");
  const hasBetterFavicon =
    faviconSourceRank(favicon.source) > faviconSourceRank(existing.faviconSource);
  return !existing.faviconUrl || linkChanged || hasBetterFavicon;
}

async function updateExistingFeed(
  tx: Transaction,
  existing: ExistingFeed,
  resolved: ResolvedRemoteFeed,
  favicon: FaviconEnrichment,
  now: Date,
): Promise<UpsertedFeed> {
  await tx
    .update(feeds)
    .set({
      title: resolved.title,
      description: resolved.description,
      link: resolved.link,
      submittedUrl: existing.submittedUrl ?? resolved.submittedUrl,
      siteUrl: resolved.siteUrl ?? resolved.link,
      canonicalFeedUrl: resolved.canonicalFeedUrl,
      discoveredFromUrl: resolved.discoveredFromUrl ?? existing.discoveredFromUrl,
      discoveryProvenance:
        resolved.discoveredFromUrl !== null
          ? resolved.discoveryProvenance
          : (existing.discoveryProvenance ?? resolved.discoveryProvenance),
      updatedAt: now,
      ...(shouldApplyFavicon(existing, resolved, favicon)
        ? { faviconUrl: favicon.url, faviconSource: favicon.source, faviconFetchedAt: now }
        : {}),
    })
    .where(eq(feeds.id, existing.id));

  const [final] = await tx
    .select({ faviconUrl: feeds.faviconUrl, faviconSource: feeds.faviconSource })
    .from(feeds)
    .where(eq(feeds.id, existing.id))
    .limit(1);

  return {
    feedId: existing.id,
    newFeed: false,
    faviconUrl: final?.faviconUrl ?? null,
    faviconSource: final?.faviconSource ?? null,
  };
}

async function insertFeed(
  tx: Transaction,
  resolved: ResolvedRemoteFeed,
  favicon: FaviconEnrichment,
  now: Date,
): Promise<UpsertedFeed> {
  const feedId = crypto.randomUUID();
  await tx.insert(feeds).values({
    id: feedId,
    url: resolved.canonicalUrl,
    submittedUrl: resolved.submittedUrl,
    siteUrl: resolved.siteUrl ?? resolved.link,
    canonicalFeedUrl: resolved.canonicalFeedUrl,
    discoveredFromUrl: resolved.discoveredFromUrl,
    discoveryProvenance: resolved.discoveryProvenance,
    title: resolved.title,
    description: resolved.description,
    link: resolved.link,
    createdAt: now,
    updatedAt: now,
    faviconUrl: favicon?.url ?? null,
    faviconSource: favicon?.source ?? null,
    faviconFetchedAt: favicon ? now : null,
  });

  return {
    feedId,
    newFeed: true,
    faviconUrl: favicon?.url ?? null,
    faviconSource: favicon?.source ?? null,
  };
}

/**
 * Upsert the global `feeds` row by canonical URL. Returns the feed ID and
 * whether a new row was inserted.
 */
export async function upsertFeedRecord(
  tx: Transaction,
  resolved: ResolvedRemoteFeed,
  favicon: FaviconEnrichment,
  now: Date,
): Promise<UpsertedFeed> {
  const [existing] = await tx
    .select({
      id: feeds.id,
      link: feeds.link,
      submittedUrl: feeds.submittedUrl,
      discoveredFromUrl: feeds.discoveredFromUrl,
      discoveryProvenance: feeds.discoveryProvenance,
      faviconUrl: feeds.faviconUrl,
      faviconSource: feeds.faviconSource,
    })
    .from(feeds)
    .where(eq(feeds.url, resolved.canonicalUrl))
    .limit(1);

  return existing
    ? updateExistingFeed(tx, existing, resolved, favicon, now)
    : insertFeed(tx, resolved, favicon, now);
}

export type SubscriptionInsertOptions = {
  folderId?: string | null;
  customTitle?: string | null;
};

/**
 * Ensure a `feed_subscriptions` row exists for the user, using a conflict-safe insert-first
 * write so duplicate delivery (e.g. a retried OPML item) can never race the unique
 * (userId, feedId) constraint. If a subscription already exists, its folder/customTitle are
 * left untouched — only a newly inserted row gets the requested metadata.
 */
export async function subscribeUserToFeed(
  tx: Transaction,
  userId: string,
  feedId: string,
  now: Date,
  options?: SubscriptionInsertOptions,
): Promise<{ subscriptionId: string; newSubscription: boolean }> {
  const subscriptionId = crypto.randomUUID();
  const folderId =
    options?.folderId ?? (await getOrCreateFolderByName(tx, userId, DEFAULT_FOLDER_NAME)).id;

  const inserted = await tx
    .insert(feedSubscriptions)
    .values({
      id: subscriptionId,
      userId,
      feedId,
      folderId,
      customTitle: options?.customTitle?.trim() || null,
      createdAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: feedSubscriptions.id });

  if (inserted[0]) {
    return { subscriptionId: inserted[0].id, newSubscription: true };
  }

  const existingSub = await tx
    .select({ id: feedSubscriptions.id })
    .from(feedSubscriptions)
    .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
    .limit(1);
  if (!existingSub[0]) {
    throw new Error("Subscription insert conflicted but no existing row was found");
  }
  return { subscriptionId: existingSub[0].id, newSubscription: false };
}
