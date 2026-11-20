import { Effect } from "effect";
import { and, eq, inArray } from "drizzle-orm";
import { feedSubscriptions, folders } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { currentDate } from "@shared/effect/clock";
import { NotFound } from "@shared/effect/errors";
import { emptyUpdate, invalidFeedIds, notSubscribed, subscriptionNotFound } from "../errors";
import type {
  BulkMoveFeedsResponseDto,
  BulkUnsubscribeResponseDto,
  MessageResponseDto,
  UpdateFeedSubscriptionBody,
} from "../types";

/** Trimmed, de-duplicated, non-empty ids; a bulk request left with none is invalid. */
const uniqueFeedIds = Effect.fn("feeds.subscription.unique_ids")(function* (
  feedIds: readonly string[],
) {
  const unique = [...new Set(feedIds.map((id) => id.trim()).filter((id) => id.length > 0))];
  if (unique.length === 0) {
    return yield* invalidFeedIds();
  }
  return unique;
});

/** Remove the current user’s subscription to a feed (does not delete the global `feeds` row). */
export const unsubscribeFromFeed = Effect.fn("feeds.subscription.unsubscribe")(function* (
  userId: string,
  feedId: string,
) {
  const db = yield* Db;
  const log = yield* AppLogger;
  const removed = yield* db.use("feeds.unsubscribe", (client) =>
    client
      .delete(feedSubscriptions)
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
      .returning({ id: feedSubscriptions.id }),
  );

  if (removed.length === 0) {
    return yield* subscriptionNotFound();
  }

  yield* log.info("feeds.unsubscribe", { userId, feedId });
  return { message: "Unsubscribed successfully" } satisfies MessageResponseDto;
});

/** Bulk-unsubscribe for the given feed ids (must all belong to the user). */
export const bulkUnsubscribeFromFeeds = Effect.fn("feeds.subscription.bulk_unsubscribe")(function* (
  userId: string,
  feedIds: readonly string[],
) {
  const db = yield* Db;
  const log = yield* AppLogger;
  const unique = yield* uniqueFeedIds(feedIds);

  const removed = yield* db.use("feeds.bulk_unsubscribe", (client) =>
    client
      .delete(feedSubscriptions)
      .where(and(eq(feedSubscriptions.userId, userId), inArray(feedSubscriptions.feedId, unique)))
      .returning({ id: feedSubscriptions.id }),
  );

  yield* log.info("feeds.unsubscribe.bulk", { userId, removedCount: removed.length });
  return {
    message: `Removed ${removed.length} subscription(s)`,
    removedCount: removed.length,
  } satisfies BulkUnsubscribeResponseDto;
});

/** Bulk-move subscriptions into a user-owned folder, or out of any folder when `folderId` is null. */
export const bulkMoveFeedsToFolder = Effect.fn("feeds.subscription.bulk_move")(function* (
  userId: string,
  feedIds: readonly string[],
  folderId: string | null,
) {
  const db = yield* Db;
  const log = yield* AppLogger;
  const unique = yield* uniqueFeedIds(feedIds);

  if (folderId !== null) {
    const folderRows = yield* db.use("feeds.bulk_move.folder", (client) =>
      client
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.id, folderId), eq(folders.userId, userId)))
        .limit(1),
    );
    if (!folderRows[0]) {
      return yield* new NotFound({ message: "Folder not found", code: "FOLDER_NOT_FOUND" });
    }
  }

  const updated = yield* db.use("feeds.bulk_move", (client) =>
    client
      .update(feedSubscriptions)
      .set({ folderId })
      .where(and(eq(feedSubscriptions.userId, userId), inArray(feedSubscriptions.feedId, unique)))
      .returning({ id: feedSubscriptions.id }),
  );

  yield* log.info("feeds.folder.bulk_move", {
    userId,
    folderId,
    updatedCount: updated.length,
  });
  return { updatedCount: updated.length } satisfies BulkMoveFeedsResponseDto;
});

export const updateFeedSubscriptionSettings = Effect.fn("feeds.subscription.update_settings")(
  function* (userId: string, feedId: string, patch: UpdateFeedSubscriptionBody) {
    const db = yield* Db;
    const log = yield* AppLogger;
    if (!("customTitle" in patch) && !("isPinned" in patch)) {
      return yield* emptyUpdate();
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
      updatePatch.pinnedAt = patch.isPinned ? yield* currentDate : null;
    }

    const updated = yield* db.use("feeds.update_settings", (client) =>
      client
        .update(feedSubscriptions)
        .set(updatePatch)
        .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
        .returning({ id: feedSubscriptions.id }),
    );

    if (updated.length === 0) {
      return yield* subscriptionNotFound();
    }

    yield* log.info("feeds.subscription.updated", { userId, feedId });
    return { message: "Feed settings updated successfully" } satisfies MessageResponseDto;
  },
);

/** Ensures the user has an active subscription (e.g. before enqueueing refresh). */
export const assertUserSubscribedToFeed = Effect.fn("feeds.subscription.assert_subscribed")(
  function* (userId: string, feedId: string) {
    const db = yield* Db;
    const rows = yield* db.use("feeds.assert_subscribed", (client) =>
      client
        .select({ id: feedSubscriptions.id })
        .from(feedSubscriptions)
        .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.feedId, feedId)))
        .limit(1),
    );

    if (!rows[0]) {
      return yield* notSubscribed();
    }
  },
);
