import { Effect } from "effect";
import type { DatabaseError } from "@shared/effect/errors";
import type { Db } from "@adapters/db/service";
import {
  listFolderSummaries,
  listOldestSavedClips,
  listOldestSavedFeedItems,
  listTopViewedFeeds,
} from "./queries";
import type { InboxRecapDto, InboxRecapSavedItemDto } from "./types";

const DEFAULT_RECAP_LIMIT = 5;
const MAX_RECAP_LIMIT = 20;

export function normalizeRecapLimit(value: string | number | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RECAP_LIMIT;
  }
  return Math.min(Math.max(parsed, 1), MAX_RECAP_LIMIT);
}

/** The oldest `limit` saved articles across feed items and clips, oldest first. */
const listOldestSavedItems = (userId: string, limit: number) =>
  Effect.all([listOldestSavedFeedItems(userId, limit), listOldestSavedClips(userId, limit)], {
    concurrency: 2,
  }).pipe(
    Effect.map(([feedItemsPage, clipsPage]) =>
      [...feedItemsPage, ...clipsPage]
        .sort((left: InboxRecapSavedItemDto, right: InboxRecapSavedItemDto) => {
          const savedDiff = Date.parse(left.savedAt) - Date.parse(right.savedAt);
          if (savedDiff !== 0) {
            return savedDiff;
          }
          return left.id.localeCompare(right.id);
        })
        .slice(0, limit),
    ),
  );

export const getInboxRecap = Effect.fn("inbox.recap")(function* (
  userId: string,
  rawLimit?: string | number,
): Effect.fn.Return<InboxRecapDto, DatabaseError, Db> {
  const limit = normalizeRecapLimit(rawLimit);
  const { folders, topViewedFeeds, oldestSavedItems } = yield* Effect.all(
    {
      folders: listFolderSummaries(userId),
      topViewedFeeds: listTopViewedFeeds(userId, limit),
      oldestSavedItems: listOldestSavedItems(userId, limit),
    },
    { concurrency: 3 },
  );
  return { folders, topViewedFeeds, oldestSavedItems };
});
