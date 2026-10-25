import { describe, expect, test } from "bun:test";
import {
  SCORE_WEIGHTS,
  remainingMinutesFor,
  scoreCandidate,
  type ScoreCandidate,
} from "@modules/articles/resurface/score";

const DAY = 86_400_000;
const NOW = new Date("2026-10-24T12:00:00.000Z");
const CONTEXT = { now: NOW, maxFeedViewedItemCount: 100 };

function candidate(overrides: Partial<ScoreCandidate> = {}): ScoreCandidate {
  return {
    progress: 0.5,
    maxProgress: 0.5,
    activeReadMs: 120_000,
    contentWords: 1_000,
    lastReadAt: new Date(NOW.getTime() - DAY),
    isSaved: false,
    feedViewedItemCount: 0,
    ...overrides,
  };
}

describe("remainingMinutesFor", () => {
  test("rounds the remaining words up to whole minutes at 238 wpm", () => {
    expect(remainingMinutesFor(2_380, 0)).toBe(10);
    expect(remainingMinutesFor(2_380, 0.5)).toBe(5);
    expect(remainingMinutesFor(1_000, 0.5)).toBe(3);
    expect(remainingMinutesFor(1_000, 1)).toBe(0);
  });
});

describe("scoreCandidate", () => {
  test("matches the contract formula for a fresh, saved, familiar-feed article", () => {
    const row = candidate({
      progress: 0.5,
      maxProgress: 0.5,
      contentWords: 2_380,
      activeReadMs: 10 * 60_000,
      lastReadAt: NOW,
      isSaved: true,
      feedViewedItemCount: 100,
    });

    // remaining 5 min -> completability 1 / (1 + 5 / 8); expected 5 min read -> interest capped at 1.
    const expected = 0.35 * 0.5 + 0.25 * (1 / (1 + 5 / 8)) + 0.2 * 1 + 0.1 * 1 + 0.1 * 1;

    expect(scoreCandidate(row, CONTEXT)).toBeCloseTo(expected, 10);
  });

  test("freshness halves every 7 days under 2,000 words", () => {
    const fresh = scoreCandidate(candidate({ lastReadAt: NOW }), CONTEXT);
    const week = scoreCandidate(
      candidate({ lastReadAt: new Date(NOW.getTime() - 7 * DAY) }),
      CONTEXT,
    );

    expect(week).toBeCloseTo(fresh / 2, 10);
  });

  test("freshness halves every 21 days from 2,000 words", () => {
    const base = { contentWords: 2_000 };
    const fresh = scoreCandidate(candidate({ ...base, lastReadAt: NOW }), CONTEXT);
    const aged = scoreCandidate(
      candidate({ ...base, lastReadAt: new Date(NOW.getTime() - 21 * DAY) }),
      CONTEXT,
    );

    expect(aged).toBeCloseTo(fresh / 2, 10);
  });

  test("a read time in the future does not boost freshness above 1", () => {
    const future = scoreCandidate(
      candidate({ lastReadAt: new Date(NOW.getTime() + DAY) }),
      CONTEXT,
    );
    const now = scoreCandidate(candidate({ lastReadAt: NOW }), CONTEXT);

    expect(future).toBeCloseTo(now, 10);
  });

  test("more progress ranks higher, all else equal", () => {
    const low = scoreCandidate(candidate({ progress: 0.2, maxProgress: 0.2 }), CONTEXT);
    const high = scoreCandidate(candidate({ progress: 0.8, maxProgress: 0.8 }), CONTEXT);

    expect(high).toBeGreaterThan(low);
  });

  test("a shorter remainder ranks higher than a longer one at equal momentum", () => {
    const short = scoreCandidate(candidate({ contentWords: 600 }), CONTEXT);
    const long = scoreCandidate(candidate({ contentWords: 6_000 }), CONTEXT);

    expect(short).toBeGreaterThan(long);
  });

  test("interest rewards reading time relative to the time the progress implies", () => {
    const skimmed = scoreCandidate(candidate({ activeReadMs: 20_000 }), CONTEXT);
    const studied = scoreCandidate(candidate({ activeReadMs: 600_000 }), CONTEXT);

    expect(studied).toBeGreaterThan(skimmed);
    expect(studied - skimmed).toBeLessThanOrEqual(SCORE_WEIGHTS.interest + 1e-9);
  });

  test("affinity scales with log of the feed's viewed count and is zero for clips", () => {
    const none = scoreCandidate(candidate({ feedViewedItemCount: null }), CONTEXT);
    const zero = scoreCandidate(candidate({ feedViewedItemCount: 0 }), CONTEXT);
    const mid = scoreCandidate(candidate({ feedViewedItemCount: 10 }), CONTEXT);
    const top = scoreCandidate(candidate({ feedViewedItemCount: 100 }), CONTEXT);

    expect(none).toBeCloseTo(zero, 10);
    expect(mid).toBeGreaterThan(zero);
    expect(top).toBeGreaterThan(mid);
    const oneDayFreshness = 0.5 ** (1 / 7);
    expect(top - zero).toBeCloseTo(SCORE_WEIGHTS.affinity * oneDayFreshness, 10);
    expect(mid - zero).toBeCloseTo(
      SCORE_WEIGHTS.affinity * oneDayFreshness * (Math.log1p(10) / Math.log1p(100)),
      10,
    );
  });

  test("affinity is zero when the user has no feed view stats", () => {
    const withCount = scoreCandidate(candidate({ feedViewedItemCount: 5 }), {
      now: NOW,
      maxFeedViewedItemCount: 0,
    });
    const without = scoreCandidate(candidate({ feedViewedItemCount: 0 }), {
      now: NOW,
      maxFeedViewedItemCount: 0,
    });

    expect(withCount).toBe(without);
  });

  test("saved articles outrank otherwise identical unsaved ones", () => {
    const unsaved = scoreCandidate(candidate({ isSaved: false }), CONTEXT);
    const saved = scoreCandidate(candidate({ isSaved: true }), CONTEXT);

    expect(saved).toBeGreaterThan(unsaved);
  });

  test("is bounded between 0 and 1", () => {
    const best = scoreCandidate(
      candidate({
        progress: 1,
        maxProgress: 1,
        lastReadAt: NOW,
        isSaved: true,
        feedViewedItemCount: 100,
        activeReadMs: 10_000_000,
      }),
      CONTEXT,
    );

    expect(best).toBeGreaterThan(0);
    expect(best).toBeLessThanOrEqual(1);
  });
});
