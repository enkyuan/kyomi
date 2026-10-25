import { describe, expect, test } from "bun:test";
import {
  RESURFACE_CONFIG,
  applyDismiss,
  applyImpression,
  applyProgressWrite,
  isEligible,
  isEngaged,
  type ScheduleFields,
} from "@modules/articles/resurface/schedule";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-10-24T12:00:00.000Z");

function at(offsetMs: number): Date {
  return new Date(NOW.getTime() + offsetMs);
}

function schedule(overrides: Partial<ScheduleFields> = {}): ScheduleFields {
  return {
    state: "reading",
    dueAt: at(DAY),
    intervalDays: 1,
    ease: 2,
    impressions: 0,
    lapses: 0,
    lastImpressionAt: null,
    dismissedAt: null,
    ...overrides,
  };
}

describe("isEngaged", () => {
  test("needs both progress and active time at their thresholds", () => {
    expect(isEngaged({ maxProgress: 0.05, activeReadMs: 20_000 })).toBe(true);
    expect(isEngaged({ maxProgress: 0.049, activeReadMs: 60_000 })).toBe(false);
    expect(isEngaged({ maxProgress: 0.5, activeReadMs: 19_999 })).toBe(false);
    expect(isEngaged({ maxProgress: 0, activeReadMs: 0 })).toBe(false);
  });
});

describe("applyProgressWrite", () => {
  test("creates a reading schedule due one interval after the read on the first write", () => {
    const next = applyProgressWrite(null, {
      isNewSession: true,
      completed: false,
      lastReadAt: NOW,
      now: NOW,
    });

    expect(next).toEqual({
      state: "reading",
      dueAt: at(DAY),
      intervalDays: RESURFACE_CONFIG.initialIntervalDays,
      ease: RESURFACE_CONFIG.initialEase,
      impressions: 0,
      lapses: 0,
      lastImpressionAt: null,
      dismissedAt: null,
    });
  });

  test("a write in the same session keeps interval and ease and moves the due time", () => {
    const prev = schedule({ intervalDays: 3.6, ease: 1.8, state: "resurfacing", lapses: 1 });
    const next = applyProgressWrite(prev, {
      isNewSession: false,
      completed: false,
      lastReadAt: NOW,
      now: NOW,
    });

    expect(next.intervalDays).toBe(3.6);
    expect(next.ease).toBe(1.8);
    expect(next.state).toBe("resurfacing");
    expect(next.lapses).toBe(1);
    expect(next.dueAt).toEqual(at(3.6 * DAY));
  });

  test("a new session on a lapsed row resumes: back to reading, interval and lapses reset", () => {
    const prev = schedule({
      intervalDays: 8,
      ease: 1.4,
      state: "resurfacing",
      lapses: 3,
      lastImpressionAt: at(-3 * DAY),
    });
    const next = applyProgressWrite(prev, {
      isNewSession: true,
      completed: false,
      lastReadAt: NOW,
      now: NOW,
    });

    expect(next.state).toBe("reading");
    expect(next.intervalDays).toBe(RESURFACE_CONFIG.initialIntervalDays);
    expect(next.ease).toBeCloseTo(1.5, 10);
    expect(next.dueAt).toEqual(at(DAY));
    expect(next.lapses).toBe(0);
  });

  test("a resume within the impression cooldown refunds that impression's lapse penalty", () => {
    const shown = applyImpression(schedule({ ease: 2, dueAt: NOW }), NOW);
    const next = applyProgressWrite(shown, {
      isNewSession: true,
      completed: false,
      lastReadAt: at(HOUR),
      now: at(HOUR),
    });

    expect(shown.ease).toBeCloseTo(1.8, 10);
    expect(next.ease).toBeCloseTo(2.1, 10);
    expect(next.state).toBe("reading");
    expect(next.lapses).toBe(0);
    expect(next.impressions).toBe(1);
  });

  test("the ease bonus is capped at maxEase", () => {
    const prev = schedule({ ease: 2.95 });
    const next = applyProgressWrite(prev, {
      isNewSession: true,
      completed: false,
      lastReadAt: NOW,
      now: NOW,
    });

    expect(next.ease).toBe(RESURFACE_CONFIG.maxEase);
  });

  test("a completed write is terminal and clears the due time", () => {
    const next = applyProgressWrite(schedule({ state: "resurfacing" }), {
      isNewSession: false,
      completed: true,
      lastReadAt: NOW,
      now: NOW,
    });

    expect(next.state).toBe("completed");
    expect(next.dueAt).toBeNull();
  });

  test("a completed write on a first write completes the row", () => {
    const next = applyProgressWrite(null, {
      isNewSession: true,
      completed: true,
      lastReadAt: NOW,
      now: NOW,
    });

    expect(next.state).toBe("completed");
    expect(next.dueAt).toBeNull();
  });

  test("completed rows ignore later writes", () => {
    const prev = schedule({ state: "completed", dueAt: null });
    const next = applyProgressWrite(prev, {
      isNewSession: true,
      completed: false,
      lastReadAt: NOW,
      now: NOW,
    });

    expect(next).toEqual(prev);
  });

  test("dismissed rows ignore later writes, including completion", () => {
    const prev = schedule({ state: "dismissed", dueAt: null, dismissedAt: at(-DAY) });
    for (const completed of [false, true]) {
      const next = applyProgressWrite(prev, {
        isNewSession: true,
        completed,
        lastReadAt: NOW,
        now: NOW,
      });
      expect(next).toEqual(prev);
    }
  });

  test("an abandoned row is not revived by reading but can still be completed", () => {
    const prev = schedule({ state: "abandoned", dueAt: null, lapses: 4 });
    const resumed = applyProgressWrite(prev, {
      isNewSession: true,
      completed: false,
      lastReadAt: NOW,
      now: NOW,
    });
    const completed = applyProgressWrite(prev, {
      isNewSession: false,
      completed: true,
      lastReadAt: NOW,
      now: NOW,
    });

    expect(resumed).toEqual(prev);
    expect(completed.state).toBe("completed");
  });

  test("a last-read time ahead of the server clock is clamped to now", () => {
    const next = applyProgressWrite(null, {
      isNewSession: true,
      completed: false,
      lastReadAt: at(5 * DAY),
      now: NOW,
    });

    expect(next.dueAt).toEqual(at(DAY));
  });

  test("does not mutate the previous schedule", () => {
    const prev = schedule();
    const snapshot = structuredClone(prev);
    applyProgressWrite(prev, { isNewSession: true, completed: false, lastReadAt: NOW, now: NOW });

    expect(prev).toEqual(snapshot);
  });
});

describe("applyImpression", () => {
  test("the first impression is a lapse that grows the interval and shrinks the ease", () => {
    const next = applyImpression(schedule({ state: "reading", dueAt: NOW }), NOW);

    expect(next.state).toBe("resurfacing");
    expect(next.impressions).toBe(1);
    expect(next.lapses).toBe(1);
    expect(next.intervalDays).toBe(2);
    expect(next.ease).toBeCloseTo(1.8, 10);
    expect(next.dueAt).toEqual(at(2 * DAY));
    expect(next.lastImpressionAt).toEqual(NOW);
  });

  test("an impression inside the cooldown is idempotent", () => {
    const first = applyImpression(schedule({ dueAt: NOW }), NOW);
    const again = applyImpression(first, at(RESURFACE_CONFIG.impressionCooldownMs - 1));

    expect(again).toBe(first);
  });

  test("an impression exactly at the cooldown boundary counts", () => {
    const first = applyImpression(schedule({ dueAt: NOW }), NOW);
    const later = applyImpression(first, at(RESURFACE_CONFIG.impressionCooldownMs));

    expect(later.impressions).toBe(2);
    expect(later.lapses).toBe(2);
  });

  test("successive lapses back off and then retire the row at maxLapses", () => {
    let current = schedule({ dueAt: NOW });
    const intervals: number[] = [];
    let clock = NOW;
    for (let i = 0; i < RESURFACE_CONFIG.maxLapses; i += 1) {
      current = applyImpression(current, clock);
      intervals.push(current.intervalDays);
      clock = at(clock.getTime() - NOW.getTime() + 40 * DAY);
    }

    expect(intervals[0]).toBe(2);
    expect(intervals[1]).toBeCloseTo(3.6, 10);
    expect(intervals[2]).toBeCloseTo(5.76, 10);
    expect(intervals[3]).toBeCloseTo(8.064, 10);
    expect(current.lapses).toBe(RESURFACE_CONFIG.maxLapses);
    expect(current.state).toBe("abandoned");
    expect(current.dueAt).toBeNull();
  });

  test("the ease never drops below minEase", () => {
    const next = applyImpression(schedule({ ease: RESURFACE_CONFIG.minEase, dueAt: NOW }), NOW);

    expect(next.ease).toBe(RESURFACE_CONFIG.minEase);
  });

  test("the interval is capped at maxIntervalDays and the row is abandoned there", () => {
    const next = applyImpression(schedule({ intervalDays: 25, ease: 2, dueAt: NOW }), NOW);

    expect(next.intervalDays).toBe(RESURFACE_CONFIG.maxIntervalDays);
    expect(next.state).toBe("abandoned");
    expect(next.dueAt).toBeNull();
    expect(next.lapses).toBe(1);
  });

  test("terminal and abandoned rows are untouched", () => {
    for (const state of ["completed", "dismissed", "abandoned"] as const) {
      const prev = schedule({ state, dueAt: null });
      expect(applyImpression(prev, NOW)).toBe(prev);
    }
  });
});

describe("applyDismiss", () => {
  test("moves a live row to dismissed and stops scheduling it", () => {
    for (const state of ["reading", "resurfacing"] as const) {
      const next = applyDismiss(schedule({ state }), NOW);
      expect(next.state).toBe("dismissed");
      expect(next.dueAt).toBeNull();
      expect(next.dismissedAt).toEqual(NOW);
    }
  });

  test("is idempotent and keeps the first dismissal time", () => {
    const first = applyDismiss(schedule(), at(-DAY));
    const second = applyDismiss(first, NOW);

    expect(second).toBe(first);
    expect(second.dismissedAt).toEqual(at(-DAY));
  });

  test("does not reopen a completed row", () => {
    const prev = schedule({ state: "completed", dueAt: null });

    expect(applyDismiss(prev, NOW)).toBe(prev);
  });
});

describe("isEligible", () => {
  const eligible = {
    ...schedule({ dueAt: at(-HOUR) }),
    maxProgress: 0.4,
    activeReadMs: 90_000,
    contentWords: 1_200,
    lastReadAt: at(-RESURFACE_CONFIG.minGapMs),
    isHidden: false,
  };

  test("accepts a due, engaged, long-enough, rested, visible row", () => {
    expect(isEligible(eligible, NOW)).toBe(true);
    expect(isEligible({ ...eligible, state: "resurfacing" }, NOW)).toBe(true);
  });

  test("rejects non-live states", () => {
    for (const state of ["completed", "dismissed", "abandoned"] as const) {
      expect(isEligible({ ...eligible, state }, NOW)).toBe(false);
    }
  });

  test("rejects rows that are not engaged", () => {
    expect(isEligible({ ...eligible, maxProgress: 0.04 }, NOW)).toBe(false);
    expect(isEligible({ ...eligible, activeReadMs: 19_000 }, NOW)).toBe(false);
  });

  test("rejects short or unmeasured articles", () => {
    expect(isEligible({ ...eligible, contentWords: RESURFACE_CONFIG.minWords - 1 }, NOW)).toBe(
      false,
    );
    expect(isEligible({ ...eligible, contentWords: RESURFACE_CONFIG.minWords }, NOW)).toBe(true);
    expect(isEligible({ ...eligible, contentWords: null }, NOW)).toBe(false);
  });

  test("rejects rows that are not due yet, accepts exactly due", () => {
    expect(isEligible({ ...eligible, dueAt: at(1) }, NOW)).toBe(false);
    expect(isEligible({ ...eligible, dueAt: NOW }, NOW)).toBe(true);
    expect(isEligible({ ...eligible, dueAt: null }, NOW)).toBe(false);
  });

  test("rejects rows read within the minimum gap", () => {
    expect(isEligible({ ...eligible, lastReadAt: at(-RESURFACE_CONFIG.minGapMs + 1) }, NOW)).toBe(
      false,
    );
  });

  test("rejects hidden articles", () => {
    expect(isEligible({ ...eligible, isHidden: true }, NOW)).toBe(false);
  });
});
