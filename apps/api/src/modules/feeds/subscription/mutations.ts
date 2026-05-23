import { and, eq, inArray } from "drizzle-orm";
import { feedSubscriptions, folders } from "@vols.rss/db";
import type { db } from "@adapters/db/client";
import { AppError } from "@shared/errors/app";
import type {
  BulkMoveFeedsResponseDto,
  BulkUnsubscribeResponseDto,
  MessageResponseDto,
  UpdateFeedSubscriptionBody,
} from "../types";

type DB = typeof db;

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
  if (!("customTitle" in patch) && !("isPinned" in patch)) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }

  const updatePatch: Partial<{
    customTitle: string | null;
    isPinned: boolean;
    pinnedAt: Date | null;
  }> = {};

  if ("customTitle" in patch) {
    updatePatch.customTitle = patch.customTitle ?? null;
  }

  if ("isPinned" in patch && typeof patch.isPinned === "boolean") {
    updatePatch.isPinned = patch.isPinned;
    updatePatch.pinnedAt = patch.isPinned ? new Date() : null;
  }

  const updated = await database
    .update(feedSubscriptions)
    .set(updatePatch)
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
