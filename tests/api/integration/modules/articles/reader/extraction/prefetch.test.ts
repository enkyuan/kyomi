import { describe, expect, test } from "bun:test";
import { getTableName } from "drizzle-orm";
import { feedItems } from "@kyomi/db";
import { prefetchArticleExtractionsForFeedItems } from "@modules/articles/reader/extraction/prefetch";
import type { ArticleExtractionJob } from "@kyomi/worker";

type FakeFeedItemRow = {
  id: string;
  extractedContentStatus: string;
  extractedContentUpdatedAt: Date | null;
  extractedContentError: string | null;
};

function tableName(table: unknown): string {
  return getTableName(table as Parameters<typeof getTableName>[0]);
}

function createPrefetchDb(rows: FakeFeedItemRow[]) {
  let failedPatchIndex = 0;
  return {
    rows,
    update: (table: unknown) => ({
      set: (patch: Partial<FakeFeedItemRow>) => {
        const name = tableName(table);
        if (name !== "feed_items") {
          throw new Error(`Unexpected update ${name}`);
        }
        return {
          where: () => {
            if (patch.extractedContentStatus === "failed") {
              const row = rows.filter(
                (candidate) => candidate.extractedContentStatus === "pending",
              )[failedPatchIndex];
              failedPatchIndex += 1;
              if (row) {
                Object.assign(row, patch);
              }
            }
            return {
              returning: () => {
                const claimed = rows.filter(
                  (row) =>
                    row.extractedContentStatus === "pending" &&
                    row.extractedContentUpdatedAt === null,
                );
                for (const row of claimed) {
                  Object.assign(row, patch);
                }
                return Promise.resolve(claimed.map((row) => ({ id: row.id })));
              },
            };
          },
        };
      },
    }),
  };
}

describe("article extraction prefetch", () => {
  test("claims only never-requested pending feed items before enqueueing jobs", async () => {
    const db = createPrefetchDb([
      {
        id: "item-1",
        extractedContentStatus: "pending",
        extractedContentUpdatedAt: null,
        extractedContentError: null,
      },
      {
        id: "item-2",
        extractedContentStatus: "pending",
        extractedContentUpdatedAt: new Date("2026-07-01T00:00:00.000Z"),
        extractedContentError: null,
      },
      {
        id: "item-3",
        extractedContentStatus: "ready",
        extractedContentUpdatedAt: new Date("2026-07-01T00:00:00.000Z"),
        extractedContentError: null,
      },
    ]);
    const jobs: ArticleExtractionJob[] = [];

    const result = await prefetchArticleExtractionsForFeedItems(
      db as never,
      { articleIds: ["item-1", "item-2", "item-3"], userId: "system", reason: "scheduled" },
      {
        enqueueExtractionJob: async (job) => {
          jobs.push(job);
          return "job-1";
        },
      },
    );

    expect(result).toMatchObject({
      candidateCount: 3,
      claimedCount: 1,
      queuedCount: 1,
      failedCount: 0,
      skippedCount: 2,
    });
    expect(jobs).toMatchObject([
      {
        type: "article.extract",
        payload: { articleId: "item-1", userId: "system", reason: "scheduled" },
      },
    ]);
    expect(db.rows[0]?.extractedContentUpdatedAt).toBeInstanceOf(Date);
    expect(db.rows[1]?.extractedContentUpdatedAt).toEqual(new Date("2026-07-01T00:00:00.000Z"));
    expect(db.rows[2]?.extractedContentStatus).toBe("ready");
  });

  test("marks claimed rows failed when queue publish fails", async () => {
    const db = createPrefetchDb([
      {
        id: "item-1",
        extractedContentStatus: "pending",
        extractedContentUpdatedAt: null,
        extractedContentError: null,
      },
    ]);

    const result = await prefetchArticleExtractionsForFeedItems(
      db as never,
      { articleIds: ["item-1"], userId: "system", reason: "scheduled" },
      {
        enqueueExtractionJob: async () => {
          throw new Error("redis unavailable");
        },
      },
    );

    expect(result).toMatchObject({ claimedCount: 1, queuedCount: 0, failedCount: 1 });
    expect(db.rows[0]).toMatchObject({
      extractedContentStatus: "failed",
      extractedContentError: "Full text extraction could not be queued.",
    });
  });
});
