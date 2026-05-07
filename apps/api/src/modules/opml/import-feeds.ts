import type { db } from "@adapters/db/client";
import { createOrSubscribeToFeed } from "@modules/feeds/service";
import { AppError } from "@shared/errors/app-error";
import type { OpmlImportSummary, OpmlUrlFailure } from "./types";

type DB = typeof db;
const OPML_IMPORT_CONCURRENCY = 4;

export async function importOpmlFeedUrls(
  database: DB,
  userId: string,
  urls: string[],
): Promise<OpmlImportSummary> {
  const results: Array<
    { url: string; subscribed: boolean } | { url: string; failure: OpmlUrlFailure }
  > = new Array(urls.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= urls.length) {
        return;
      }

      const url = urls[currentIndex]!;
      try {
        const result = await createOrSubscribeToFeed(database, userId, url);
        results[currentIndex] = { url, subscribed: result.newSubscription };
      } catch (error) {
        const err =
          error instanceof AppError
            ? error
            : new AppError(error instanceof Error ? error.message : "Import failed", {
                status: 500,
                code: "OPML_FEED_IMPORT_FAILED",
              });
        results[currentIndex] = {
          url,
          failure: { url, code: err.code, message: err.message },
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(OPML_IMPORT_CONCURRENCY, urls.length) }, () => runWorker()),
  );

  const failures: OpmlUrlFailure[] = [];
  let subscribed = 0;
  let alreadySubscribed = 0;

  for (const result of results) {
    if (!result) {
      continue;
    }
    if ("failure" in result) {
      failures.push(result.failure);
      continue;
    }
    if (result.subscribed) {
      subscribed += 1;
    } else {
      alreadySubscribed += 1;
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
