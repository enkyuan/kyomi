import { describe, expect, test } from "bun:test";
import {
  ACTIVE_TIME_SLACK_MS,
  countContentWords,
  FIRST_WRITE_WALL_MS,
  reduceProgressWrite,
  type ReadingStateRow,
} from "@modules/articles/progress/write";
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
  SESSION_A,
  SESSION_B,
} from "./fakes";

/** Feeds the reducer's output back in as the stored row, like successive requests do. */
function stored(values: ReturnType<typeof reduceProgressWrite>): ReadingStateRow {
  return {
    id: "state-1",
    userId: "user-1",
    feedItemId: FEED_ITEM_ID,
    clipId: null,
    updatedAt: values.lastReadAt,
    ...values,
  };
}

describe("reduceProgressWrite", () => {
  test("first write creates the row with a computed schedule", () => {
    const values = reduceProgressWrite(null, body(), atMs(0), 1_000);

    expect(values).toMatchObject({
      progress: 0.5,
      maxProgress: 0.5,
      contentKey: "feed_html:v1",
      contentWords: 1_000,
      activeReadMs: 8_000,
      sessionCount: 1,
      lastSessionId: SESSION_A,
      lastSessionActiveMs: 8_000,
      state: "reading",
      completedAt: null,
    });
    expect(values.firstReadAt).toEqual(atMs(0));
    expect(values.lastReadAt).toEqual(atMs(0));
    expect(values.dueAt).toEqual(atMs(86_400_000));
  });

  test("first write bounds active time because there is no previous write to measure from", () => {
    const values = reduceProgressWrite(null, body({ sessionActiveMs: 600_000 }), atMs(0), 1_000);

    expect(values.activeReadMs).toBe(FIRST_WRITE_WALL_MS + ACTIVE_TIME_SLACK_MS);
    expect(values.lastSessionActiveMs).toBe(600_000);
  });

  test("a newer write replaces the position and an older write leaves it unchanged", () => {
    const first = stored(
      reduceProgressWrite(
        null,
        body({
          progress: 0.6,
          anchor: { kind: "block", blockIndex: 4, offset: 0.2, fingerprint: "f" },
          clientUpdatedAt: atMs(20_000).toISOString(),
        }),
        atMs(20_000),
        1_000,
      ),
    );

    const stale = reduceProgressWrite(
      first,
      body({ progress: 0.2, contentKey: "other", clientUpdatedAt: atMs(5_000).toISOString() }),
      atMs(30_000),
      null,
    );

    expect(stale.progress).toBe(0.6);
    expect(stale.contentKey).toBe("feed_html:v1");
    expect(stale.anchor).toEqual(first.anchor);
    expect(stale.clientUpdatedAt).toEqual(first.clientUpdatedAt);

    const fresh = reduceProgressWrite(
      first,
      body({ progress: 0.7, clientUpdatedAt: atMs(29_000).toISOString() }),
      atMs(30_000),
      null,
    );
    expect(fresh.progress).toBe(0.7);
    expect(fresh.clientUpdatedAt).toEqual(atMs(29_000));
  });

  test("a stale write still raises the high-water mark and counts its active time", () => {
    const first = stored(reduceProgressWrite(null, body({ progress: 0.4 }), atMs(10_000), 1_000));

    const stale = reduceProgressWrite(
      first,
      body({
        progress: 0.8,
        sessionActiveMs: 12_000,
        clientUpdatedAt: atMs(-60_000).toISOString(),
      }),
      atMs(20_000),
      null,
    );

    expect(stale.progress).toBe(0.4);
    expect(stale.maxProgress).toBe(0.8);
    expect(stale.activeReadMs).toBe(12_000);
  });

  test("max progress never decreases when the reader scrolls back up", () => {
    const first = stored(reduceProgressWrite(null, body({ progress: 0.8 }), atMs(10_000), 1_000));

    const back = reduceProgressWrite(
      first,
      body({ progress: 0.1, clientUpdatedAt: atMs(12_000).toISOString() }),
      atMs(12_000),
      null,
    );

    expect(back.progress).toBe(0.1);
    expect(back.maxProgress).toBe(0.8);
  });

  test("a client clock ahead of the server is clamped to server time", () => {
    const values = reduceProgressWrite(
      null,
      body({ clientUpdatedAt: atMs(3_600_000).toISOString() }),
      atMs(0),
      1_000,
    );

    expect(values.clientUpdatedAt).toEqual(atMs(0));
  });

  test("an unparseable client timestamp falls back to server time", () => {
    const values = reduceProgressWrite(
      null,
      body({ clientUpdatedAt: "not a date" }),
      atMs(0),
      1_000,
    );

    expect(values.clientUpdatedAt).toEqual(atMs(0));
  });

  test("retrying the same session and cumulative value adds nothing", () => {
    const first = stored(reduceProgressWrite(null, body(), atMs(10_000), 1_000));

    const retry = reduceProgressWrite(first, body(), atMs(11_000), null);

    expect(retry.activeReadMs).toBe(8_000);
    expect(retry.sessionCount).toBe(1);
    expect(retry.lastSessionActiveMs).toBe(8_000);
  });

  test("the same session adds only the growth in cumulative active time", () => {
    const first = stored(reduceProgressWrite(null, body(), atMs(10_000), 1_000));

    const next = reduceProgressWrite(first, body({ sessionActiveMs: 18_000 }), atMs(20_000), null);

    expect(next.activeReadMs).toBe(18_000);
    expect(next.sessionCount).toBe(1);
  });

  test("an out-of-order lower cumulative value adds nothing and keeps the higher watermark", () => {
    const first = stored(
      reduceProgressWrite(null, body({ sessionActiveMs: 18_000 }), atMs(10_000), 1_000),
    );

    const late = reduceProgressWrite(first, body({ sessionActiveMs: 8_000 }), atMs(11_000), null);

    expect(late.activeReadMs).toBe(18_000);
    expect(late.lastSessionActiveMs).toBe(18_000);
  });

  test("a new session counts as a session and adds its active time", () => {
    const first = stored(reduceProgressWrite(null, body(), atMs(10_000), 1_000));

    const second = reduceProgressWrite(
      first,
      body({ sessionId: SESSION_B, sessionActiveMs: 5_000 }),
      atMs(3_600_000),
      null,
    );

    expect(second.sessionCount).toBe(2);
    expect(second.activeReadMs).toBe(13_000);
    expect(second.lastSessionId).toBe(SESSION_B);
    expect(second.lastSessionActiveMs).toBe(5_000);
  });

  test("a new session is a resume that resets the interval and earns an ease bonus", () => {
    const first = stored({
      ...reduceProgressWrite(null, body(), atMs(10_000), 1_000),
      intervalDays: 8,
      ease: 1.6,
      state: "resurfacing",
    });

    const second = reduceProgressWrite(
      first,
      body({ sessionId: SESSION_B, sessionActiveMs: 1_000 }),
      atMs(3_600_000),
      null,
    );

    expect(second.state).toBe("reading");
    expect(second.intervalDays).toBe(1);
    expect(second.ease).toBeCloseTo(1.7);
  });

  test("active time is clamped to the wall time since the previous write plus slack", () => {
    const first = stored(reduceProgressWrite(null, body({ sessionActiveMs: 0 }), atMs(0), 1_000));

    // Ten seconds passed, but the client claims an hour of active reading.
    const claimed = reduceProgressWrite(
      first,
      body({ sessionActiveMs: 3_600_000 }),
      atMs(10_000),
      null,
    );

    expect(claimed.activeReadMs).toBe(10_000 + ACTIVE_TIME_SLACK_MS);
    // The claim is remembered, so repeating it cannot mint more time.
    expect(claimed.lastSessionActiveMs).toBe(3_600_000);
    const repeated = reduceProgressWrite(
      stored(claimed),
      body({ sessionActiveMs: 3_600_000 }),
      atMs(10_500),
      null,
    );
    expect(repeated.activeReadMs).toBe(claimed.activeReadMs);
  });

  test("content words are computed on the first write and kept afterwards", () => {
    const first = stored(reduceProgressWrite(null, body(), atMs(10_000), 1_000));

    const next = reduceProgressWrite(first, body({ sessionActiveMs: 9_000 }), atMs(20_000), 50);

    expect(first.contentWords).toBe(1_000);
    expect(next.contentWords).toBe(1_000);
  });

  test("explicit completion sets completedAt once and moves the schedule to completed", () => {
    const first = stored(reduceProgressWrite(null, body({ progress: 0.5 }), atMs(10_000), 1_000));

    const done = reduceProgressWrite(
      first,
      body({ progress: 0.6, completed: true, clientUpdatedAt: atMs(15_000).toISOString() }),
      atMs(15_000),
      null,
    );
    expect(done.completedAt).toEqual(atMs(15_000));
    expect(done.state).toBe("completed");
    expect(done.dueAt).toBeNull();

    const later = reduceProgressWrite(
      stored(done),
      body({ progress: 0.7, clientUpdatedAt: atMs(40_000).toISOString() }),
      atMs(40_000),
      null,
    );
    expect(later.completedAt).toEqual(atMs(15_000));
    expect(later.state).toBe("completed");
  });

  test("reaching 90 percent completes without an explicit flag", () => {
    const values = reduceProgressWrite(null, body({ progress: 0.9 }), atMs(10_000), 1_000);

    expect(values.completedAt).toEqual(atMs(10_000));
    expect(values.state).toBe("completed");
  });

  test("just under the threshold does not complete", () => {
    const values = reduceProgressWrite(null, body({ progress: 0.89 }), atMs(10_000), 1_000);

    expect(values.completedAt).toBeNull();
    expect(values.state).toBe("reading");
  });
});

describe("countContentWords", () => {
  const common = {
    contentStatus: "ready",
    contentSource: "feed_html",
    contentBaseUrl: null,
    title: null,
    byline: null,
    excerpt: null,
    siteName: null,
    language: null,
    publishedTime: null,
    notice: null,
    extractionErrorCode: null,
    extractionErrorMessage: null,
    shouldExtract: false,
  } as const;

  test("counts stored text, falling back to the body for html and markdown", () => {
    expect(
      countContentWords({
        ...common,
        bodyKind: "html",
        contentHtml: "<p>one two</p>",
        contentMarkdown: null,
        contentText: "one two three",
        fallbackSummary: null,
        fallbackReason: null,
      }),
    ).toBe(3);
    expect(
      countContentWords({
        ...common,
        bodyKind: "html",
        contentHtml: "<p>alpha beta</p><p>gamma delta epsilon</p>",
        contentMarkdown: null,
        contentText: null,
        fallbackSummary: null,
        fallbackReason: null,
      }),
    ).toBe(5);
    expect(
      countContentWords({
        ...common,
        bodyKind: "markdown",
        contentHtml: null,
        contentMarkdown: "# Title\n\nsome words here",
        contentText: null,
        fallbackSummary: null,
        fallbackReason: null,
      }),
    ).toBe(5);
    expect(
      countContentWords({
        ...common,
        bodyKind: "fallback",
        contentHtml: null,
        contentMarkdown: null,
        contentText: null,
        fallbackSummary: null,
        fallbackReason: "missing_content",
      }),
    ).toBe(0);
  });
});
