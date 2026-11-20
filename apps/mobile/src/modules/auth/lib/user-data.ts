import { clearOfflineLibrary } from "@lib/offline/library";
import { clearQueryCache } from "@lib/query/client";
import { createAppStorage } from "@lib/storage";
import { clearReaderPositions } from "@modules/reader/lib/position";
import { readingProgressSync } from "@modules/reader/lib/progress-store";
import { clearRecentArticles } from "@modules/recents/lib/store";

const owner = createAppStorage("session-owner");
const OWNER_KEY = "user-id";

/**
 * Removes everything the signed-in account left on this device, in memory and on disk: cached
 * articles, folders and feeds, reading history, reading positions, and progress writes (queued or
 * in flight) that would otherwise be sent under the next session. The theme is a device setting and
 * stays.
 */
export function clearUserData(nextOwner?: string): void {
  owner.remove(OWNER_KEY);
  clearOfflineLibrary(nextOwner);
  clearQueryCache();
  clearRecentArticles();
  clearReaderPositions();
  readingProgressSync.reset();
}

export function isSessionOwner(userId: string): boolean {
  return owner.getString(OWNER_KEY) === userId;
}

/**
 * Makes `userId` the account the cached data belongs to. Data left by any other account, or by an
 * unknown one (a sign-out that never ran, a revoked session, an app from before this record), is
 * removed first, so a different account never sees or replays it.
 */
export function adoptSessionUser(userId: string): void {
  if (isSessionOwner(userId)) return;

  clearUserData(userId);
  owner.set(OWNER_KEY, userId);
}
