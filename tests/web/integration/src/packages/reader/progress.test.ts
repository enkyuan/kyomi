import { describe, expect, test } from "vitest";
import {
  READING_COMPLETE_THRESHOLD,
  READING_FLUSH_INTERVAL_MS,
  READING_IDLE_TIMEOUT_MS,
  READING_LINE_RATIO,
  buildContentKey,
  createActiveTimer,
  createReadingSession,
  formatRemainingMinutes,
  isContinuingReading,
  progressFromScroll,
  scrollTopForProgress,
  type ReaderContent,
} from "@kyomi/reader/core";
import {
  readingProgressUpdateBodySchema,
  type ReadingProgressDto,
  type ReadingState,
} from "@kyomi/reader/schemas/article";

const layout = { viewportHeight: 800, contentTop: 300, contentHeight: 4_000 };
const SESSION_ID = "6f1c1f0e-4f55-4c1a-8f0e-2d4e9b7a1c11";

function createClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}

describe("reading progress constants", () => {
  test("match the contract", () => {
    expect(READING_FLUSH_INTERVAL_MS).toBe(10_000);
    expect(READING_IDLE_TIMEOUT_MS).toBe(30_000);
    expect(READING_COMPLETE_THRESHOLD).toBe(0.9);
    expect(READING_LINE_RATIO).toBe(0.25);
  });
});

describe("progressFromScroll", () => {
  test("is 0 until the reading line reaches the article body", () => {
    expect(progressFromScroll({ ...layout, scrollTop: 0 })).toBe(0);
    // Reading line at 100 + 200 = 300, exactly at the body top.
    expect(progressFromScroll({ ...layout, scrollTop: 100 })).toBe(0);
  });

  test("measures the reading line within the body", () => {
    // Reading line at 1_100 + 200 = 1_300, a quarter of the way through 4_000.
    expect(progressFromScroll({ ...layout, scrollTop: 1_100 })).toBeCloseTo(0.25, 10);
  });

  test("clamps to 1 past the end of the body", () => {
    expect(progressFromScroll({ ...layout, scrollTop: 10_000 })).toBe(1);
  });

  test("clamps negative scroll (overscroll) to 0", () => {
    expect(progressFromScroll({ ...layout, scrollTop: -120 })).toBe(0);
  });

  test("returns 0 for an empty or invalid body", () => {
    expect(progressFromScroll({ ...layout, contentHeight: 0, scrollTop: 500 })).toBe(0);
    expect(progressFromScroll({ ...layout, contentHeight: Number.NaN, scrollTop: 500 })).toBe(0);
    expect(progressFromScroll({ ...layout, scrollTop: Number.NaN })).toBe(0);
  });
});

describe("scrollTopForProgress", () => {
  test("places the reading line at the requested progress", () => {
    expect(scrollTopForProgress(0.25, layout)).toBeCloseTo(1_100, 10);
    expect(scrollTopForProgress(1, layout)).toBeCloseTo(300 + 4_000 - 200, 10);
  });

  test("never returns a negative scroll offset", () => {
    expect(scrollTopForProgress(0, layout)).toBe(100);
    expect(scrollTopForProgress(0, { ...layout, contentTop: 0 })).toBe(0);
  });

  test("clamps out-of-range progress", () => {
    expect(scrollTopForProgress(-1, layout)).toBe(scrollTopForProgress(0, layout));
    expect(scrollTopForProgress(2, layout)).toBe(scrollTopForProgress(1, layout));
    expect(scrollTopForProgress(Number.NaN, layout)).toBe(scrollTopForProgress(0, layout));
  });

  test("is the exact inverse of progressFromScroll within clamping", () => {
    for (const progress of [0, 0.001, 0.05, 0.25, 0.5, 0.9, 0.999, 1]) {
      const scrollTop = scrollTopForProgress(progress, layout);
      expect(progressFromScroll({ ...layout, scrollTop })).toBeCloseTo(progress, 10);
    }
    for (const scrollTop of [100, 101, 1_100, 2_500, 4_100]) {
      const progress = progressFromScroll({ ...layout, scrollTop });
      expect(scrollTopForProgress(progress, layout)).toBeCloseTo(scrollTop, 8);
    }
  });

  test("handles a body that starts above the reading line", () => {
    const flush = { viewportHeight: 800, contentTop: 0, contentHeight: 4_000 };
    // progress 0 would need scrollTop -200; the inverse clamps at 0, which maps back to 0.05.
    expect(scrollTopForProgress(0, flush)).toBe(0);
    expect(progressFromScroll({ ...flush, scrollTop: 0 })).toBeCloseTo(0.05, 10);
  });
});

describe("buildContentKey", () => {
  const html: ReaderContent = {
    bodyKind: "html",
    contentSource: "feed_html",
    contentHtml: "<p>a</p>",
  };

  test("uses the content source and falls back to none without a sanitizer version", () => {
    expect(buildContentKey(html)).toBe("feed_html:none");
  });

  test("is stable for equal content and differs across sources", () => {
    expect(buildContentKey({ ...html })).toBe(buildContentKey(html));
    expect(buildContentKey({ ...html, contentSource: "extracted_html" })).toBe(
      "extracted_html:none",
    );
    expect(buildContentKey({ ...html, contentSource: "extracted_html" })).not.toBe(
      buildContentKey(html),
    );
  });

  test("ignores body text so edits to the same source keep the key", () => {
    expect(buildContentKey({ ...html, contentHtml: "<p>changed</p>", title: "Other" })).toBe(
      buildContentKey(html),
    );
  });

  test("includes a sanitizer version when the content carries one", () => {
    const versioned = { ...html, sanitizerVersion: "2" } as ReaderContent;
    expect(buildContentKey(versioned)).toBe("feed_html:2");
  });

  test("falls back to the body kind when the source is missing", () => {
    expect(buildContentKey({ bodyKind: "text", contentSource: null })).toBe("text:none");
    expect(buildContentKey({ bodyKind: "fallback" })).toBe("fallback:none");
  });

  test("never exceeds the 128 character wire limit", () => {
    const versioned = { ...html, sanitizerVersion: "v".repeat(400) } as ReaderContent;
    expect(buildContentKey(versioned).length).toBe(128);
  });
});

describe("createActiveTimer", () => {
  test("starts at zero and counts time while the reader stays active", () => {
    const clock = createClock();
    const timer = createActiveTimer(clock.now);
    expect(timer.elapsedMs()).toBe(0);
    clock.advance(5_000);
    expect(timer.elapsedMs()).toBe(5_000);
    timer.markActivity();
    clock.advance(10_000);
    expect(timer.elapsedMs()).toBe(15_000);
  });

  test("stops accruing once idle for the timeout and resumes on activity", () => {
    const clock = createClock();
    const timer = createActiveTimer(clock.now);
    clock.advance(READING_IDLE_TIMEOUT_MS + 60_000);
    expect(timer.elapsedMs()).toBe(READING_IDLE_TIMEOUT_MS);

    timer.markActivity();
    clock.advance(4_000);
    expect(timer.elapsedMs()).toBe(READING_IDLE_TIMEOUT_MS + 4_000);
  });

  test("activity inside the window extends it", () => {
    const clock = createClock();
    const timer = createActiveTimer(clock.now);
    clock.advance(20_000);
    timer.markActivity();
    clock.advance(20_000);
    timer.markActivity();
    clock.advance(READING_IDLE_TIMEOUT_MS + 10_000);
    expect(timer.elapsedMs()).toBe(20_000 + 20_000 + READING_IDLE_TIMEOUT_MS);
  });

  test("does not accrue while hidden", () => {
    const clock = createClock();
    const timer = createActiveTimer(clock.now);
    clock.advance(5_000);
    timer.setVisible(false);
    clock.advance(120_000);
    expect(timer.elapsedMs()).toBe(5_000);
  });

  test("returning to visible counts as activity and restarts the idle window", () => {
    const clock = createClock();
    const timer = createActiveTimer(clock.now);
    clock.advance(5_000);
    timer.setVisible(false);
    clock.advance(120_000);
    timer.setVisible(true);
    clock.advance(10_000);
    expect(timer.elapsedMs()).toBe(15_000);
    clock.advance(READING_IDLE_TIMEOUT_MS);
    expect(timer.elapsedMs()).toBe(5_000 + READING_IDLE_TIMEOUT_MS);
  });

  test("hiding while idle does not credit time past the idle window", () => {
    const clock = createClock();
    const timer = createActiveTimer(clock.now);
    clock.advance(READING_IDLE_TIMEOUT_MS + 5_000);
    timer.setVisible(false);
    timer.setVisible(true);
    expect(timer.elapsedMs()).toBe(READING_IDLE_TIMEOUT_MS);
  });

  test("redundant visibility changes are harmless", () => {
    const clock = createClock();
    const timer = createActiveTimer(clock.now);
    timer.setVisible(true);
    clock.advance(1_000);
    timer.setVisible(true);
    expect(timer.elapsedMs()).toBe(1_000);
  });

  test("ignores a clock that moves backwards", () => {
    const clock = createClock();
    const timer = createActiveTimer(clock.now);
    clock.advance(3_000);
    expect(timer.elapsedMs()).toBe(3_000);
    clock.advance(-2_000);
    expect(timer.elapsedMs()).toBe(3_000);
  });
});

describe("createReadingSession", () => {
  function setup() {
    const clock = createClock(Date.parse("2026-10-24T10:00:00.000Z"));
    const timer = createActiveTimer(clock.now);
    const session = createReadingSession({
      contentKey: "feed_html:none",
      timer,
      now: clock.now,
      createId: () => SESSION_ID,
    });
    return { clock, timer, session };
  }

  test("uses the injected session id", () => {
    expect(setup().session.sessionId).toBe(SESSION_ID);
  });

  test("generates a uuid session id by default", () => {
    const session = createReadingSession({
      contentKey: "feed_html:none",
      timer: createActiveTimer(),
    });
    expect(session.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  test("has nothing to send before the first sample", () => {
    const { session, clock } = setup();
    clock.advance(5_000);
    expect(session.takeUpdate()).toBeNull();
  });

  test("returns a full update body that satisfies the wire schema", () => {
    const { session, clock } = setup();
    clock.advance(4_000);
    session.sample({ progress: 0.4 });
    const update = session.takeUpdate();
    expect(update).toEqual({
      progress: 0.4,
      anchor: null,
      contentKey: "feed_html:none",
      sessionId: SESSION_ID,
      sessionActiveMs: 4_000,
      completed: false,
      clientUpdatedAt: "2026-10-24T10:00:04.000Z",
    });
    expect(readingProgressUpdateBodySchema.safeParse(update).success).toBe(true);
  });

  test("returns null when nothing changed since the last take", () => {
    const { session, clock, timer } = setup();
    session.sample({ progress: 0.4 });
    expect(session.takeUpdate()).not.toBeNull();
    expect(session.takeUpdate()).toBeNull();

    // Sampling the same progress while the timer is idle changes nothing.
    clock.advance(READING_IDLE_TIMEOUT_MS * 2);
    timer.elapsedMs();
    session.sample({ progress: 0.4 });
    const afterIdle = session.takeUpdate();
    expect(afterIdle?.sessionActiveMs).toBe(READING_IDLE_TIMEOUT_MS);
    session.sample({ progress: 0.4 });
    expect(session.takeUpdate()).toBeNull();
  });

  test("sends again when progress, completion or active time changes", () => {
    const { session, clock } = setup();
    session.sample({ progress: 0.2 });
    expect(session.takeUpdate()?.progress).toBe(0.2);

    session.sample({ progress: 0.3 });
    expect(session.takeUpdate()?.progress).toBe(0.3);

    clock.advance(2_000);
    expect(session.takeUpdate()?.sessionActiveMs).toBe(2_000);

    session.sample({ progress: 0.3, completed: true });
    expect(session.takeUpdate()?.completed).toBe(true);
  });

  test("keeps the latest progress and a sticky completed flag", () => {
    const { session } = setup();
    session.sample({ progress: 0.5 });
    session.sample({ progress: 1, completed: true });
    session.sample({ progress: 0.7 });
    const update = session.takeUpdate();
    expect(update?.progress).toBe(0.7);
    expect(update?.completed).toBe(true);
  });

  test("reports cumulative active time across takes", () => {
    const { session, clock } = setup();
    session.sample({ progress: 0.1 });
    clock.advance(10_000);
    expect(session.takeUpdate()?.sessionActiveMs).toBe(10_000);
    clock.advance(10_000);
    expect(session.takeUpdate()?.sessionActiveMs).toBe(20_000);
  });

  test("clamps sampled progress into 0..1", () => {
    const { session } = setup();
    session.sample({ progress: 3 });
    expect(session.takeUpdate()?.progress).toBe(1);
    session.sample({ progress: -2 });
    expect(session.takeUpdate()?.progress).toBe(0);
    session.sample({ progress: Number.NaN });
    expect(session.takeUpdate()).toBeNull();
  });

  test("floors fractional active time to an integer", () => {
    const { session, clock } = setup();
    session.sample({ progress: 0.1 });
    clock.advance(1_500.7);
    expect(session.takeUpdate()?.sessionActiveMs).toBe(1_500);
  });
});

describe("isContinuingReading", () => {
  const base: ReadingProgressDto = {
    progress: 0.4,
    maxProgress: 0.4,
    state: "reading",
    engaged: true,
    remainingMinutes: 6,
    lastReadAt: "2026-10-24T10:00:00.000Z",
    completedAt: null,
  };

  test("is true for engaged reading and resurfacing rows", () => {
    expect(isContinuingReading(base)).toBe(true);
    expect(isContinuingReading({ ...base, state: "resurfacing" })).toBe(true);
  });

  test("is false for every terminal state", () => {
    const terminal: ReadingState[] = ["completed", "dismissed", "abandoned"];
    for (const state of terminal) {
      expect(isContinuingReading({ ...base, state })).toBe(false);
    }
  });

  test("is false when not engaged", () => {
    expect(isContinuingReading({ ...base, engaged: false })).toBe(false);
    expect(isContinuingReading({ ...base, state: "resurfacing", engaged: false })).toBe(false);
  });

  test("is false without a progress row", () => {
    expect(isContinuingReading(null)).toBe(false);
    expect(isContinuingReading(undefined)).toBe(false);
  });
});

describe("formatRemainingMinutes", () => {
  test("formats whole minutes in the compact timestamp unit", () => {
    expect(formatRemainingMinutes(6)).toBe("6m left");
    expect(formatRemainingMinutes(1)).toBe("1m left");
    expect(formatRemainingMinutes(59)).toBe("59m left");
  });

  test("switches to hours from an hour", () => {
    expect(formatRemainingMinutes(60)).toBe("1h left");
    expect(formatRemainingMinutes(75)).toBe("1h left");
    expect(formatRemainingMinutes(90)).toBe("2h left");
  });

  test("labels sub-minute and zero estimates", () => {
    expect(formatRemainingMinutes(0)).toBe("<1m left");
    expect(formatRemainingMinutes(0.4)).toBe("<1m left");
    expect(formatRemainingMinutes(-3)).toBe("<1m left");
  });

  test("returns null for unknown estimates", () => {
    expect(formatRemainingMinutes(null)).toBeNull();
    expect(formatRemainingMinutes(Number.NaN)).toBeNull();
  });
});
