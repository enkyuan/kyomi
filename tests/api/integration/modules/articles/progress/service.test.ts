import { describe, expect, test } from "bun:test";
import { reduceProgressWrite, writeArticleProgressForUser } from "@modules/articles/progress/write";
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

describe("writeArticleProgressForUser", () => {
  test("first write for a feed item inserts one row with the counted words", async () => {
    const db = createProgressDb({ feedItems: [feedItemRow()] });

    const dto = await writeArticleProgressForUser(db as never, "user-1", FEED_ITEM_ID, body(), NOW);

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

    await writeArticleProgressForUser(db as never, "user-1", CLIP_ID, body(), NOW);

    expect(db.inserts[0]).toMatchObject({ clipId: CLIP_ID, feedItemId: null });
  });

  test("another user's clip is rejected with not found and writes nothing", async () => {
    const db = createProgressDb({ clips: [clipRow({ userId: "user-2" })] });

    await expect(
      writeArticleProgressForUser(db as never, "user-1", CLIP_ID, body(), NOW),
    ).rejects.toMatchObject({ status: 404, code: "ARTICLE_NOT_FOUND" });
    expect(db.inserts).toHaveLength(0);
  });

  test("an unknown article is rejected with not found", async () => {
    const db = createProgressDb();

    await expect(
      writeArticleProgressForUser(db as never, "user-1", FEED_ITEM_ID, body(), NOW),
    ).rejects.toMatchObject({ status: 404, code: "ARTICLE_NOT_FOUND" });
  });

  test("successive requests accumulate on one row and retries are idempotent", async () => {
    const db = createProgressDb({ feedItems: [feedItemRow()] });
    const send = (offsetMs: number, overrides: Partial<ReadingProgressUpdateBody>) =>
      writeArticleProgressForUser(
        db as never,
        "user-1",
        FEED_ITEM_ID,
        body({ clientUpdatedAt: atMs(offsetMs).toISOString(), ...overrides }),
        atMs(offsetMs),
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

    const empty = await writeArticleProgressForUser(
      db as never,
      "user-1",
      FEED_ITEM_ID,
      body(),
      NOW,
    );

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

    const current = await writeArticleProgressForUser(
      withRow as never,
      "user-1",
      FEED_ITEM_ID,
      body({ progress: 0.9, completed: true }),
      NOW,
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

    await expect(
      writeArticleProgressForUser(db as never, "user-1", CLIP_ID, body(), NOW),
    ).rejects.toMatchObject({ status: 404 });
  });
});
