import { and, eq, inArray } from "drizzle-orm";
import { feedSubscriptions, feeds, folders } from "@cronos/db";
import type { db } from "@adapters/db/client";
import { upsertFeedSearchDocument } from "@adapters/search/meili";
import { resolveRemoteFeed } from "@modules/discover/discover.resolve-remote-feed";
import { AppError } from "@shared/errors/app-error";
import { DEFAULT_FOLDER_NAME, getOrCreateFolderByName } from "@modules/folders/folders.service";
import { decodeNullableText, decodeText } from "@shared/text/html-entities";
import { displayFeedTitle } from "./feeds.display-title";
import type {
  BulkUnsubscribeResponseDto,
  BulkMoveFeedsResponseDto,
  FeedDetailDto,
  FeedSubscribeResultDto,
  MessageResponseDto,
  SubscribedFeedListItemDto,
  UpdateFeedSubscriptionBody,
} from "./feeds.types";

type DB = typeof db;

export async function listSubscribedFeeds(
  database: DB,
  userId: string,
): Promise<SubscribedFeedListItemDto[]> {
  const rows = await database
    .select({
      subscriptionId: feedSubscriptions.id,
      feedId: feeds.id,
      url: feeds.url,
      feedTitle: feeds.title,
      customTitle: feedSubscriptions.customTitle,
      link: feeds.link,
      folderId: feedSubscriptions.folderId,
      folderName: folders.name,
      subscribedAt: feedSubscriptions.createdAt,
    })
    .from(feedSubscriptions)
    .innerJoin(feeds, eq(feedSubscriptions.feedId, feeds.id))
    .leftJoin(folders, eq(feedSubscriptions.folderId, folders.id))
    .where(eq(feedSubscriptions.userId, userId));

  return rows.map((r) => ({
    subscriptionId: r.subscriptionId,
    feedId: r.feedId,
    url: r.url,
    title: decodeText(displayFeedTitle(r.feedTitle, r.customTitle)),
    customTitle: r.customTitle,
    link: r.link,
    folderId: r.folderId,
    folderName: r.folderName,
    subscribedAt: r.subscribedAt.toISOString(),
  }));
}

/**
 * Fetch feed document, upsert `feeds` by canonical URL, ensure `feed_subscriptions` row for user.
 */
export async function createOrSubscribeToFeed(
  database: DB,
  userId: string,
  rawUrl: string,
): Promise<FeedSubscribeResultDto> {
  const resolved = await resolveRemoteFeed(rawUrl);
  const result = await database.transaction(async (tx) => {
    const now = new Date();

    const existingFeed = await tx
      .select({ id: feeds.id })
      .from(feeds)
      .where(eq(feeds.url, resolved.canonicalUrl))
      .limit(1);

    let feedId: string;
    let newFeed = false;
    if (existingFeed[0]) {
      feedId = existingFeed[0].id;
      await tx
        .update(feeds)
        .set({
          title: resolved.title,
          description: resolved.description,
          link: resolved.link,
          updatedAt: now,
        })
        .where(eq(feeds.id, feedId));
    } else {
      newFeed = true;
      feedId = crypto.randomUUID();
      await tx.insert(feeds).values({
        id: feedId,
        url: resolved.canonicalUrl,
        title: resolved.title,
        description: resolved.description,
        link: resolved.link,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingSub = await tx
      .select({ id: feedSubscriptions.id })
      .from(feedSubscriptions)
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
      .limit(1);

    if (existingSub[0]) {
      return {
        feedId,
        subscriptionId: existingSub[0].id,
        url: resolved.canonicalUrl,
        title: decodeText(resolved.title),
        link: resolved.link,
        newFeed,
        newSubscription: false,
      };
    }

    const subscriptionId = crypto.randomUUID();
    const defaultFolder = await getOrCreateFolderByName(tx, userId, DEFAULT_FOLDER_NAME);
    await tx.insert(feedSubscriptions).values({
      id: subscriptionId,
      userId,
      feedId,
      folderId: defaultFolder.id,
      createdAt: now,
    });

    return {
      feedId,
      subscriptionId,
      url: resolved.canonicalUrl,
      title: decodeText(resolved.title),
      link: resolved.link,
      newFeed,
      newSubscription: true,
    };
  });

  await upsertFeedSearchDocument({
    id: result.feedId,
    url: result.url,
    title: decodeText(result.title),
    description: decodeText(resolved.description),
    link: result.link,
  }).catch(() => undefined);

  return result;
}

/** Subscribe to a feed row that already exists (no remote fetch). */
export async function subscribeToExistingFeed(
  database: DB,
  userId: string,
  feedId: string,
): Promise<FeedSubscribeResultDto> {
  return await database.transaction(async (tx) => {
    const now = new Date();

    const feedRow = await tx
      .select({
        id: feeds.id,
        url: feeds.url,
        title: feeds.title,
        link: feeds.link,
      })
      .from(feeds)
      .where(eq(feeds.id, feedId))
      .limit(1);

    const feed = feedRow[0];
    if (!feed) {
      throw new AppError("Feed not found", { status: 404, code: "FEED_NOT_FOUND" });
    }

    const existingSub = await tx
      .select({ id: feedSubscriptions.id })
      .from(feedSubscriptions)
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
      .limit(1);

    if (existingSub[0]) {
      return {
        feedId: feed.id,
        subscriptionId: existingSub[0].id,
        url: feed.url,
        title: decodeText(feed.title),
        link: feed.link,
        newFeed: false,
        newSubscription: false,
      };
    }

    const subscriptionId = crypto.randomUUID();
    const defaultFolder = await getOrCreateFolderByName(tx, userId, DEFAULT_FOLDER_NAME);
    await tx.insert(feedSubscriptions).values({
      id: subscriptionId,
      userId,
      feedId,
      folderId: defaultFolder.id,
      createdAt: now,
    });

    return {
      feedId: feed.id,
      subscriptionId,
      url: feed.url,
      title: decodeText(feed.title),
      link: feed.link,
      newFeed: false,
      newSubscription: true,
    };
  });
}

/** Load feed by id; include subscription fields when the current user is subscribed. */
export async function getFeedDetailForUser(
  database: DB,
  userId: string,
  feedId: string,
): Promise<FeedDetailDto> {
  const feedRows = await database
    .select({
      id: feeds.id,
      url: feeds.url,
      title: feeds.title,
      description: feeds.description,
      link: feeds.link,
      createdAt: feeds.createdAt,
      updatedAt: feeds.updatedAt,
    })
    .from(feeds)
    .where(eq(feeds.id, feedId))
    .limit(1);

  const feed = feedRows[0];
  if (!feed) {
    throw new AppError("Feed not found", { status: 404, code: "FEED_NOT_FOUND" });
  }

  const subRows = await database
    .select({
      id: feedSubscriptions.id,
      createdAt: feedSubscriptions.createdAt,
      customTitle: feedSubscriptions.customTitle,
    })
    .from(feedSubscriptions)
    .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
    .limit(1);

  const sub = subRows[0];

  return {
    id: feed.id,
    url: feed.url,
    title: decodeText(displayFeedTitle(feed.title, sub?.customTitle)),
    customTitle: sub?.customTitle ?? null,
    description: decodeNullableText(feed.description),
    link: feed.link,
    createdAt: feed.createdAt.toISOString(),
    updatedAt: feed.updatedAt.toISOString(),
    isSubscribed: Boolean(sub),
    subscriptionId: sub?.id ?? null,
    subscribedAt: sub ? sub.createdAt.toISOString() : null,
  };
}

/** Remove the current user’s subscription to a feed (does not delete the global `feeds` row). */
export async function unsubscribeFromFeed(
  database: DB,
  userId: string,
  feedId: string,
): Promise<MessageResponseDto> {
  const removed = await database
    .delete(feedSubscriptions)
    .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
    .returning({ id: feedSubscriptions.id });

  if (removed.length === 0) {
    throw new AppError("Subscription not found", { status: 404, code: "SUBSCRIPTION_NOT_FOUND" });
  }

  return { message: "Unsubscribed successfully" };
}

/** Bulk-unsubscribe for the given feed ids (must all belong to the user). */
export async function bulkUnsubscribeFromFeeds(
  database: DB,
  userId: string,
  feedIds: string[],
): Promise<BulkUnsubscribeResponseDto> {
  const unique = [...new Set(feedIds.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (unique.length === 0) {
    throw new AppError("feedIds must contain at least one id", {
      status: 400,
      code: "INVALID_FEED_IDS",
    });
  }

  const removed = await database
    .delete(feedSubscriptions)
    .where(and(eq(feedSubscriptions.userId, userId), inArray(feedSubscriptions.feedId, unique)))
    .returning({ id: feedSubscriptions.id });

  return {
    message: `Removed ${removed.length} subscription(s)`,
    removedCount: removed.length,
  };
}

/** Bulk-move subscriptions into a user-owned folder. */
export async function bulkMoveFeedsToFolder(
  database: DB,
  userId: string,
  feedIds: string[],
  folderId: string,
): Promise<BulkMoveFeedsResponseDto> {
  const unique = [...new Set(feedIds.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (unique.length === 0) {
    throw new AppError("feedIds must contain at least one id", {
      status: 400,
      code: "INVALID_FEED_IDS",
    });
  }

  const folderRows = await database
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
    .limit(1);
  if (!folderRows[0]) {
    throw new AppError("Folder not found", { status: 404, code: "FOLDER_NOT_FOUND" });
  }

  const updated = await database
    .update(feedSubscriptions)
    .set({ folderId })
    .where(and(eq(feedSubscriptions.userId, userId), inArray(feedSubscriptions.feedId, unique)))
    .returning({ id: feedSubscriptions.id });

  return { updatedCount: updated.length };
}

export async function updateFeedSubscriptionSettings(
  database: DB,
  userId: string,
  feedId: string,
  patch: UpdateFeedSubscriptionBody,
): Promise<MessageResponseDto> {
  if (!("customTitle" in patch)) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }

  const updated = await database
    .update(feedSubscriptions)
    .set({ customTitle: patch.customTitle ?? null })
    .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
    .returning({ id: feedSubscriptions.id });

  if (updated.length === 0) {
    throw new AppError("Subscription not found", { status: 404, code: "SUBSCRIPTION_NOT_FOUND" });
  }

  return { message: "Feed settings updated successfully" };
}

/** Ensures the user has an active subscription (e.g. before enqueueing refresh). */
export async function assertUserSubscribedToFeed(
  database: DB,
  userId: string,
  feedId: string,
): Promise<void> {
  const rows = await database
    .select({ id: feedSubscriptions.id })
    .from(feedSubscriptions)
    .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
    .limit(1);

  if (!rows[0]) {
    throw new AppError("Not subscribed to this feed", { status: 403, code: "NOT_SUBSCRIBED" });
  }
}
