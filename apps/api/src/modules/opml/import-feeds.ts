import type { db } from "@adapters/db/client";
import { createOrSubscribeToFeed } from "@modules/feeds/service";
import { AppError } from "@shared/errors/app-error";
import type { OpmlImportSummary, OpmlUrlFailure } from "./types";

type DB = typeof db;

export async function importOpmlFeedUrls(
  database: DB,
  userId: string,
  urls: string[],
): Promise<OpmlImportSummary> {
  const failures: OpmlUrlFailure[] = [];
  let subscribed = 0;
  let alreadySubscribed = 0;

  for (const url of urls) {
    try {
      const result = await createOrSubscribeToFeed(database, userId, url);
      if (result.newSubscription) {
        subscribed += 1;
      } else {
        alreadySubscribed += 1;
      }
    } catch (error) {
      const err =
        error instanceof AppError
          ? error
          : new AppError(error instanceof Error ? error.message : "Import failed", {
              status: 500,
              code: "OPML_FEED_IMPORT_FAILED",
            });
      failures.push({ url, code: err.code, message: err.message });
    }
  }

  return {
    subscribed,
    alreadySubscribed,
    failed: failures.length,
    failures,
    totalUrls: urls.length,
  };
}
