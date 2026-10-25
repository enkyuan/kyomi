/**
 * Spaced-resurfacing schedule for unfinished articles. Pure functions only: every clock reading is
 * an explicit `now` so the schedule is deterministic and testable without a database.
 *
 * An article that keeps being shown without being resumed is shown less and less (the interval
 * grows by the ease factor, which itself shrinks on each lapse) and is finally retired. Resuming
 * the article resets the interval and gives the ease a small bonus.
 */

export type ReadingState = "reading" | "resurfacing" | "completed" | "dismissed" | "abandoned";

export const RESURFACE_CONFIG = {
  engagedMinProgress: 0.05,
  engagedMinActiveMs: 20_000,
  completeThreshold: 0.9,
  minWords: 400,
  minGapMs: 6 * 3_600_000,
  initialIntervalDays: 1,
  initialEase: 2,
  minEase: 1.3,
  maxEase: 3,
  easeBonus: 0.1,
  lapsePenalty: 0.2,
  maxLapses: 4,
  maxIntervalDays: 30,
  impressionCooldownMs: 20 * 3_600_000,
} as const;

export type ScheduleFields = {
  state: ReadingState;
  dueAt: Date | null;
  intervalDays: number;
  ease: number;
  impressions: number;
  lapses: number;
  lastImpressionAt: Date | null;
  dismissedAt: Date | null;
};

const DAY_MS = 86_400_000;

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * DAY_MS);
}

/** Whether the row can still be scheduled: only `reading` and `resurfacing` rows are live. */
function isLive(state: ReadingState): boolean {
  return state === "reading" || state === "resurfacing";
}

/** Engaged: the reader got past the first lines and spent real time. Only engaged rows resurface. */
export function isEngaged(input: { maxProgress: number; activeReadMs: number }): boolean {
  return (
    input.maxProgress >= RESURFACE_CONFIG.engagedMinProgress &&
    input.activeReadMs >= RESURFACE_CONFIG.engagedMinActiveMs
  );
}

function initialSchedule(): ScheduleFields {
  return {
    state: "reading",
    dueAt: null,
    intervalDays: RESURFACE_CONFIG.initialIntervalDays,
    ease: RESURFACE_CONFIG.initialEase,
    impressions: 0,
    lapses: 0,
    lastImpressionAt: null,
    dismissedAt: null,
  };
}

/**
 * Schedule after an accepted position write.
 *
 * - `completed` and `dismissed` are terminal and never change here, except that a completed write
 *   retires an `abandoned` row to `completed`. An abandoned row is not revived by reading.
 * - A completed write moves a live row to `completed` and clears the due time.
 * - Any other write on a live row sets `dueAt = lastReadAt + intervalDays`. A new session is a
 *   resume: the row returns to `reading`, the interval resets, the run of ignored impressions
 *   ends, and the ease earns a bonus. A resume within the impression cooldown came from that
 *   impression, so the impression's lapse penalty is refunded as well.
 */
export function applyProgressWrite(
  prev: ScheduleFields | null,
  input: { isNewSession: boolean; completed: boolean; lastReadAt: Date; now: Date },
): ScheduleFields {
  const base = prev ?? initialSchedule();
  // A client clock ahead of the server must not push the due time into the future.
  const lastReadAt =
    input.lastReadAt.getTime() > input.now.getTime() ? input.now : input.lastReadAt;

  if (base.state === "completed" || base.state === "dismissed") {
    return base;
  }

  if (input.completed) {
    return { ...base, state: "completed", dueAt: null };
  }

  if (!isLive(base.state)) {
    return base;
  }

  const resumed = input.isNewSession && prev !== null;
  if (!resumed) {
    return { ...base, dueAt: addDays(lastReadAt, base.intervalDays) };
  }

  const fromImpression =
    base.lastImpressionAt !== null &&
    input.now.getTime() - base.lastImpressionAt.getTime() < RESURFACE_CONFIG.impressionCooldownMs;
  const bonus = RESURFACE_CONFIG.easeBonus + (fromImpression ? RESURFACE_CONFIG.lapsePenalty : 0);
  const intervalDays = RESURFACE_CONFIG.initialIntervalDays;

  return {
    ...base,
    state: "reading",
    intervalDays,
    ease: Math.min(RESURFACE_CONFIG.maxEase, base.ease + bonus),
    lapses: 0,
    dueAt: addDays(lastReadAt, intervalDays),
  };
}

/**
 * Schedule after the article was shown in Continue reading. An impression inside the cooldown is a
 * repeat of the same sighting and changes nothing, which keeps retries and double reports
 * idempotent. Otherwise it is a lapse: the interval grows, the ease shrinks, and the row is
 * retired once it has lapsed `maxLapses` times or reached `maxIntervalDays`.
 */
export function applyImpression(prev: ScheduleFields, now: Date): ScheduleFields {
  if (!isLive(prev.state)) {
    return prev;
  }
  if (
    prev.lastImpressionAt !== null &&
    now.getTime() - prev.lastImpressionAt.getTime() < RESURFACE_CONFIG.impressionCooldownMs
  ) {
    return prev;
  }

  const intervalDays = Math.min(RESURFACE_CONFIG.maxIntervalDays, prev.intervalDays * prev.ease);
  const ease = Math.max(RESURFACE_CONFIG.minEase, prev.ease - RESURFACE_CONFIG.lapsePenalty);
  const lapses = prev.lapses + 1;
  const retired =
    lapses >= RESURFACE_CONFIG.maxLapses || intervalDays >= RESURFACE_CONFIG.maxIntervalDays;

  return {
    ...prev,
    state: retired ? "abandoned" : "resurfacing",
    dueAt: retired ? null : addDays(now, intervalDays),
    intervalDays,
    ease,
    impressions: prev.impressions + 1,
    lapses,
    lastImpressionAt: now,
  };
}

/** The user asked not to see this again. Terminal; only a live row can be dismissed. */
export function applyDismiss(prev: ScheduleFields, now: Date): ScheduleFields {
  if (!isLive(prev.state)) {
    return prev;
  }
  return { ...prev, state: "dismissed", dueAt: null, dismissedAt: now };
}

export function isEligible(
  row: ScheduleFields & {
    maxProgress: number;
    activeReadMs: number;
    contentWords: number | null;
    lastReadAt: Date;
    isHidden: boolean;
  },
  now: Date,
): boolean {
  return (
    isLive(row.state) &&
    isEngaged(row) &&
    row.contentWords !== null &&
    row.contentWords >= RESURFACE_CONFIG.minWords &&
    row.dueAt !== null &&
    row.dueAt.getTime() <= now.getTime() &&
    now.getTime() - row.lastReadAt.getTime() >= RESURFACE_CONFIG.minGapMs &&
    !row.isHidden
  );
}
