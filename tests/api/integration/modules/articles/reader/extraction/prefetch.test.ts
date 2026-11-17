import { describe, expect, test } from "bun:test";
import { Effect, Fiber, Layer } from "effect";
import { getTableName } from "drizzle-orm";
import { prefetchArticleExtractionsForFeedItems } from "@modules/articles/reader/extraction/prefetch";
import { fakeDb, fakeQueue, recordingLogger } from "@api-tests/support/layers";
import { publishedJob } from "./workflow-harness";

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
              // Awaiting the query itself (the failed-state UPDATE) resolves with no rows.
              then: (resolve: (value: void) => unknown) => Promise.resolve().then(resolve),
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

function prefetchServices(db: ReturnType<typeof createPrefetchDb>, xadd: () => Promise<string>) {
  const logs = recordingLogger();
  const published: unknown[][] = [];
  const layer = Layer.mergeAll(
    fakeDb(db as never),
    fakeQueue({
      xadd: (...args: unknown[]) => {
        published.push(args);
        return xadd();
      },
    }),
    logs.layer,
  );
  return { logs, published, layer };
}

describe("article extraction prefetch", () => {
  test("an interruption right after the claim still publishes the claimed jobs", async () => {
    const db = createPrefetchDb([
      {
        id: "item-1",
        extractedContentStatus: "pending",
        extractedContentUpdatedAt: null,
        extractedContentError: null,
      },
    ]);
    const { layer, published } = prefetchServices(db, async () => "1-0");

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          prefetchArticleExtractionsForFeedItems({
            articleIds: ["item-1"],
            userId: "user-1",
            reason: "scheduled",
          }),
        );
        // Let the fiber start and reach the claim UPDATE, then interrupt it.
        yield* Effect.yieldNow;
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(layer)),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(published).toHaveLength(1);
  });

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
    const services = prefetchServices(db, async () => "1-0");

    const result = await Effect.runPromise(
      prefetchArticleExtractionsForFeedItems({
        articleIds: ["item-1", "item-2", "item-3"],
        userId: "system",
        reason: "scheduled",
      }).pipe(Effect.provide(services.layer)),
    );

    expect(result).toMatchObject({
      candidateCount: 3,
      claimedCount: 1,
      queuedCount: 1,
      failedCount: 0,
      skippedCount: 2,
    });
    expect(services.published.map(publishedJob)).toMatchObject([
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

    const services = prefetchServices(db, async () => {
      throw new Error("redis unavailable");
    });

    const result = await Effect.runPromise(
      prefetchArticleExtractionsForFeedItems({
        articleIds: ["item-1"],
        userId: "system",
        reason: "scheduled",
      }).pipe(Effect.provide(services.layer)),
    );

    expect(result).toMatchObject({ claimedCount: 1, queuedCount: 0, failedCount: 1 });
    expect(services.logs.entries).toContainEqual(
      expect.objectContaining({
        level: "warn",
        event: "articles.extract_full_text.prefetch_enqueue_failed",
        context: expect.objectContaining({ articleId: "item-1", userId: "system" }),
      }),
    );
    expect(db.rows[0]).toMatchObject({
      extractedContentStatus: "failed",
      extractedContentError: "Full text extraction could not be queued.",
    });
  });
});
