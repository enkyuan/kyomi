import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { writeArticleProgressForUser } from "@modules/articles/progress/operations";
import type { ReadingProgressUpdateBody } from "@modules/articles/progress/types";
import { reduceProgressWrite } from "@modules/articles/progress/write";
import { fakeDb, testConfig } from "@api-tests/support/layers";
import {
  ARTICLE_WORDS,
  atMs,
  body,
  CLIP_ID,
  clipRow,
  createProgressDb,
  FEED_ITEM_ID,
  feedItemRow,
  NOW,
  SESSION_B,
} from "./fakes";

/** One write at `now` (the Effect clock), against the in-memory database. */
function write(
  db: ReturnType<typeof createProgressDb>,
  userId: string,
  articleId: string,
  update: ReadingProgressUpdateBody,
  now: Date,
) {
  return Effect.gen(function* () {
    yield* TestClock.setTime(now.getTime());
    return yield* writeArticleProgressForUser(userId, articleId, update);
  }).pipe(Effect.provide(Layer.mergeAll(fakeDb(db as never), testConfig(), TestClock.layer())));
}

describe("writeArticleProgressForUser", () => {
  test("first write for a feed item inserts one row with the counted words", async () => {
    const db = createProgressDb({ feedItems: [feedItemRow()] });

    const dto = await Effect.runPromise(write(db, "user-1", FEED_ITEM_ID, body(), NOW));

    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]).toMatchObject({
      table: "article_reading_state",
      userId: "user-1",
      feedItemId: FEED_ITEM_ID,
      clipId: null,
      contentWords: ARTICLE_WORDS.split(" ").length,
    });
    expect(dto).toMatchObject({
      progress: 0.5,
      maxProgress: 0.5,
      state: "reading",
      engaged: false,
      remainingMinutes: Math.ceil((1_000 * 0.5) / 238),
      lastReadAt: NOW.toISOString(),
      completedAt: null,
    });
  });

  test("a clip owned by the user stores its row against the clip", async () => {
    const db = createProgressDb({ clips: [clipRow()] });

    await Effect.runPromise(write(db, "user-1", CLIP_ID, body(), NOW));

    expect(db.inserts[0]).toMatchObject({ clipId: CLIP_ID, feedItemId: null });
  });

  test("another user's clip is rejected with not found and writes nothing", async () => {
    const db = createProgressDb({ clips: [clipRow({ userId: "user-2" })] });

    const error = await Effect.runPromise(
      write(db, "user-1", CLIP_ID, body(), NOW).pipe(Effect.flip),
    );

    expect(error).toMatchObject({ _tag: "NotFound", code: "ARTICLE_NOT_FOUND" });
    expect(db.inserts).toHaveLength(0);
  });

  test("an unknown article is rejected with not found", async () => {
    const db = createProgressDb();

    const error = await Effect.runPromise(
      write(db, "user-1", FEED_ITEM_ID, body(), NOW).pipe(Effect.flip),
    );

    expect(error).toMatchObject({ _tag: "NotFound", code: "ARTICLE_NOT_FOUND" });
  });

  test("successive requests accumulate on one row and retries are idempotent", async () => {
    const db = createProgressDb({ feedItems: [feedItemRow()] });
    const send = (offsetMs: number, overrides: Partial<ReadingProgressUpdateBody>) =>
      Effect.runPromise(
        write(
          db,
          "user-1",
          FEED_ITEM_ID,
          body({ clientUpdatedAt: atMs(offsetMs).toISOString(), ...overrides }),
          atMs(offsetMs),
        ),
      );

    await send(10_000, { sessionActiveMs: 10_000 });
    await send(10_500, { sessionActiveMs: 10_000 });
    const grown = await send(25_000, { progress: 0.6, sessionActiveMs: 25_000 });
    const nextSession = await send(7_200_000, {
      sessionId: SESSION_B,
      progress: 0.7,
      sessionActiveMs: 4_000,
    });

    expect(db.inserts).toHaveLength(1);
    expect(db.readingStates).toHaveLength(1);
    expect(db.readingStates[0]).toMatchObject({
      sessionCount: 2,
      activeReadMs: 29_000,
      progress: 0.7,
      maxProgress: 0.7,
    });
    expect(grown.engaged).toBe(true);
    expect(nextSession.progress).toBe(0.7);
  });

  test("with Remember reading position off the write changes nothing and returns current state", async () => {
    const db = createProgressDb({
      feedItems: [feedItemRow()],
      preferences: [{ userId: "user-1", readerRememberPosition: false }],
    });

    const empty = await Effect.runPromise(write(db, "user-1", FEED_ITEM_ID, body(), NOW));

    expect(db.inserts).toHaveLength(0);
    expect(empty).toMatchObject({ progress: 0, maxProgress: 0, state: "reading", engaged: false });

    const existing = {
      id: "state-1",
      userId: "user-1",
      feedItemId: FEED_ITEM_ID,
      clipId: null,
      ...reduceProgressWrite(
        null,
        body({ progress: 0.4, sessionActiveMs: 30_000 }),
        atMs(-5_000),
        1_000,
      ),
    };
    const withRow = createProgressDb({
      feedItems: [feedItemRow()],
      preferences: [{ userId: "user-1", readerRememberPosition: false }],
      readingStates: [existing],
    });

    const current = await Effect.runPromise(
      write(withRow, "user-1", FEED_ITEM_ID, body({ progress: 0.9, completed: true }), NOW),
    );

    expect(withRow.updates).toHaveLength(0);
    expect(current.progress).toBe(0.4);
    expect(current.completedAt).toBeNull();
  });

  test("the no-op still rejects an article the user may not access", async () => {
    const db = createProgressDb({
      clips: [clipRow({ userId: "user-2" })],
      preferences: [{ userId: "user-1", readerRememberPosition: false }],
    });

    const error = await Effect.runPromise(
      write(db, "user-1", CLIP_ID, body(), NOW).pipe(Effect.flip),
    );

    expect(error).toMatchObject({ _tag: "NotFound" });
  });

  test("a first write that loses the unique index race to a vanished row is a conflict", async () => {
    const db = createProgressDb({ feedItems: [feedItemRow()] });
    db.insert = (() => ({
      values: () => ({ onConflictDoNothing: () => ({ returning: () => Promise.resolve([]) }) }),
    })) as unknown as typeof db.insert;

    const error = await Effect.runPromise(
      write(db, "user-1", FEED_ITEM_ID, body(), NOW).pipe(Effect.flip),
    );

    expect(error).toMatchObject({ _tag: "Conflict", code: "READING_STATE_CONFLICT" });
  });

  test("a database failure surfaces as a typed DatabaseError, not a thrown exception", async () => {
    const db = createProgressDb();
    db.select = (() => {
      throw new Error("connection terminated");
    }) as unknown as typeof db.select;

    const error = await Effect.runPromise(
      write(db, "user-1", FEED_ITEM_ID, body(), NOW).pipe(Effect.flip),
    );

    expect(error._tag).toBe("DatabaseError");
  });
});
