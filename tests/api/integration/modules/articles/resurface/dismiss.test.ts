import { describe, expect, test } from "bun:test";
import { dismissContinueReading } from "@modules/articles/resurface/operations";
import { AppError } from "@shared/errors/app";
import { DAY, NOW, ago, createWriteDb, readingRow, renderSql } from "./fakes";

type Db = Parameters<typeof dismissContinueReading>[0];

function asDb(fake: ReturnType<typeof createWriteDb>): Db {
  return fake.db as unknown as Db;
}

describe("dismissContinueReading", () => {
  test("moves a live row to dismissed and clears its due time", async () => {
    for (const state of ["reading", "resurfacing"] as const) {
      const reading = readingRow({ feedItemId: "item-a", state });
      const fake = createWriteDb([{ reading }]);

      await dismissContinueReading(asDb(fake), "user-1", "item-a", NOW);

      expect(fake.updates).toHaveLength(1);
      expect(fake.updates[0]!.set).toMatchObject({
        state: "dismissed",
        dueAt: null,
        dismissedAt: NOW,
        updatedAt: NOW,
      });
      expect(renderSql(fake.updates[0]!.where!).params).toContain(reading.id);
    }
  });

  test("dismisses a clip by its id", async () => {
    const reading = readingRow({ feedItemId: null, clipId: "clip-1" });
    const fake = createWriteDb([{ reading }]);

    await dismissContinueReading(asDb(fake), "user-1", "clip-1", NOW);

    expect(fake.updates[0]!.set).toMatchObject({ state: "dismissed" });
  });

  test("is idempotent and keeps the first dismissal time", async () => {
    const reading = readingRow({
      feedItemId: "item-a",
      state: "dismissed",
      dueAt: null,
      dismissedAt: ago(DAY),
    });
    const fake = createWriteDb([{ reading }]);

    await dismissContinueReading(asDb(fake), "user-1", "item-a", NOW);

    expect(fake.updates).toEqual([]);
  });

  test("does not reopen a completed row", async () => {
    const reading = readingRow({ feedItemId: "item-a", state: "completed", dueAt: null });
    const fake = createWriteDb([{ reading }]);

    await dismissContinueReading(asDb(fake), "user-1", "item-a", NOW);

    expect(fake.updates).toEqual([]);
  });

  test("answers 404 when the caller has no reading row for the id", async () => {
    const fake = createWriteDb([]);

    const error = await dismissContinueReading(asDb(fake), "user-1", "someone-elses", NOW).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(404);
    expect(fake.updates).toEqual([]);
    const { sql, params } = renderSql(fake.queries[0]!.where!);
    expect(sql).toContain('"article_reading_state"."user_id" =');
    expect(params[0]).toBe("user-1");
  });
});
