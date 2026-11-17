import { describe, expect, test } from "bun:test";
import { dismissContinueReading } from "@modules/articles/resurface/operations";
import { DAY, NOW, ago, createWriteDb, readingRow, renderSql, run, runFailure } from "./fakes";

describe("dismissContinueReading", () => {
  test("moves a live row to dismissed and clears its due time", async () => {
    for (const state of ["reading", "resurfacing"] as const) {
      const reading = readingRow({ feedItemId: "item-a", state });
      const fake = createWriteDb([{ reading }]);

      await run(dismissContinueReading("item-a"), fake);

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

    await run(dismissContinueReading("clip-1"), fake);

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

    await run(dismissContinueReading("item-a"), fake);

    expect(fake.updates).toEqual([]);
  });

  test("does not reopen a completed row", async () => {
    const reading = readingRow({ feedItemId: "item-a", state: "completed", dueAt: null });
    const fake = createWriteDb([{ reading }]);

    await run(dismissContinueReading("item-a"), fake);

    expect(fake.updates).toEqual([]);
  });

  test("answers 404 when the caller has no reading row for the id", async () => {
    const fake = createWriteDb([]);

    const error = await runFailure(dismissContinueReading("someone-elses"), fake);

    expect(error).toMatchObject({
      _tag: "NotFound",
      code: "ARTICLE_NOT_FOUND",
      message: "Article not found",
    });
    expect(fake.updates).toEqual([]);
    const { sql, params } = renderSql(fake.queries[0]!.where!);
    expect(sql).toContain('"article_reading_state"."user_id" =');
    expect(params[0]).toBe("user-1");
  });
});
