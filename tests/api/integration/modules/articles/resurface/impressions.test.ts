import { describe, expect, test } from "bun:test";
import { recordContinueReadingImpressions } from "@modules/articles/resurface/operations";
import { RESURFACE_CONFIG } from "@modules/articles/resurface/schedule";
import { DAY, HOUR, NOW, ago, createWriteDb, readingRow, renderSql } from "./fakes";

type Db = Parameters<typeof recordContinueReadingImpressions>[0];

function asDb(fake: ReturnType<typeof createWriteDb>): Db {
  return fake.db as unknown as Db;
}

describe("recordContinueReadingImpressions", () => {
  test("applies a lapse to an eligible row and persists the schedule", async () => {
    const reading = readingRow({ feedItemId: "item-a" });
    const fake = createWriteDb([{ reading }]);

    const applied = await recordContinueReadingImpressions(asDb(fake), "user-1", ["item-a"], NOW);

    expect(applied).toBe(1);
    expect(fake.transactions).toBe(1);
    expect(fake.updates).toHaveLength(1);
    const { set, where } = fake.updates[0]!;
    expect(set).toMatchObject({
      state: "resurfacing",
      impressions: 1,
      lapses: 1,
      intervalDays: 2,
      lastImpressionAt: NOW,
      updatedAt: NOW,
    });
    expect(set.ease as number).toBeCloseTo(1.8, 10);
    expect(set.dueAt).toEqual(new Date(NOW.getTime() + 2 * DAY));
    expect(renderSql(where!).params).toContain(reading.id);
  });

  test("is idempotent inside the impression cooldown", async () => {
    const reading = readingRow({
      feedItemId: "item-a",
      state: "resurfacing",
      impressions: 1,
      lapses: 1,
      intervalDays: 2,
      lastImpressionAt: ago(RESURFACE_CONFIG.impressionCooldownMs - HOUR),
      // Even when due, a repeat within the cooldown must not count again.
      dueAt: ago(HOUR),
    });
    const fake = createWriteDb([{ reading }]);

    const applied = await recordContinueReadingImpressions(asDb(fake), "user-1", ["item-a"], NOW);

    expect(applied).toBe(0);
    expect(fake.updates).toEqual([]);
  });

  test("counts again once the cooldown has passed", async () => {
    const reading = readingRow({
      feedItemId: "item-a",
      state: "resurfacing",
      impressions: 1,
      lapses: 1,
      intervalDays: 2,
      ease: 1.8,
      lastImpressionAt: ago(RESURFACE_CONFIG.impressionCooldownMs),
      dueAt: ago(HOUR),
    });
    const fake = createWriteDb([{ reading }]);

    await recordContinueReadingImpressions(asDb(fake), "user-1", ["item-a"], NOW);

    expect(fake.updates[0]!.set).toMatchObject({ impressions: 2, lapses: 2 });
  });

  test("retires a row on its final lapse", async () => {
    const reading = readingRow({
      feedItemId: "item-a",
      state: "resurfacing",
      lapses: RESURFACE_CONFIG.maxLapses - 1,
      impressions: RESURFACE_CONFIG.maxLapses - 1,
      intervalDays: 5,
      ease: 1.4,
    });
    const fake = createWriteDb([{ reading }]);

    await recordContinueReadingImpressions(asDb(fake), "user-1", ["item-a"], NOW);

    expect(fake.updates[0]!.set).toMatchObject({ state: "abandoned", dueAt: null });
  });

  test("ignores rows that are not eligible", async () => {
    const rows = [
      readingRow({ feedItemId: "not-due", dueAt: new Date(NOW.getTime() + HOUR) }),
      readingRow({ feedItemId: "short", contentWords: 100 }),
      readingRow({ feedItemId: "unengaged", activeReadMs: 1_000 }),
      readingRow({ feedItemId: "completed", state: "completed" }),
      readingRow({ feedItemId: "dismissed", state: "dismissed" }),
      readingRow({ feedItemId: "recent", lastReadAt: ago(HOUR) }),
    ];
    const fake = createWriteDb(rows.map((reading) => ({ reading })));

    const applied = await recordContinueReadingImpressions(
      asDb(fake),
      "user-1",
      rows.map((row) => row.feedItemId!),
      NOW,
    );

    expect(applied).toBe(0);
    expect(fake.updates).toEqual([]);
  });

  test("ignores hidden articles", async () => {
    const reading = readingRow({ feedItemId: "item-a" });
    const fake = createWriteDb([{ reading, hiddenAt: ago(HOUR) }]);

    const applied = await recordContinueReadingImpressions(asDb(fake), "user-1", ["item-a"], NOW);

    expect(applied).toBe(0);
    expect(fake.updates).toEqual([]);
  });

  test("scopes the locked read to the caller and the submitted ids, locking the rows", async () => {
    const fake = createWriteDb([]);

    const applied = await recordContinueReadingImpressions(
      asDb(fake),
      "user-1",
      ["id-1", "id-2", "id-1"],
      NOW,
    );

    // Another user's ids match no rows for this caller, so nothing is written.
    expect(applied).toBe(0);
    expect(fake.updates).toEqual([]);
    expect(fake.queries).toHaveLength(1);
    const query = fake.queries[0]!;
    const { sql, params } = renderSql(query.where!);
    expect(sql).toContain('"article_reading_state"."user_id" =');
    expect(params[0]).toBe("user-1");
    expect(params.filter((param) => param === "id-1")).toHaveLength(2);
    expect(params.filter((param) => param === "id-2")).toHaveLength(2);
    expect(query.lock).toBeDefined();
    expect((query.lock as unknown[])[0]).toBe("update");
  });

  test("updates every eligible row in the same transaction", async () => {
    const first = readingRow({ feedItemId: "a" });
    const second = readingRow({ feedItemId: null, clipId: "clip-b" });
    const fake = createWriteDb([{ reading: first }, { reading: second }]);

    const applied = await recordContinueReadingImpressions(
      asDb(fake),
      "user-1",
      ["a", "clip-b"],
      NOW,
    );

    expect(applied).toBe(2);
    expect(fake.transactions).toBe(1);
    expect(fake.updates).toHaveLength(2);
  });

  test("makes no query for an empty id list", async () => {
    const fake = createWriteDb([]);

    await recordContinueReadingImpressions(asDb(fake), "user-1", [], NOW);

    expect(fake.queries).toEqual([]);
  });
});
