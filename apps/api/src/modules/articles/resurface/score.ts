/**
 * Ranking for Continue reading. A pure function over a candidate row so the formula can be tested
 * and tuned without a database:
 *
 *   priority = freshness x (0.35 momentum + 0.25 completability + 0.20 interest
 *                           + 0.10 affinity + 0.10 saved)
 */

const WORDS_PER_MINUTE = 238;
const MS_PER_MINUTE = 60_000;
const DAY_MS = 86_400_000;
const SHORT_ARTICLE_WORDS = 2_000;
const SHORT_HALF_LIFE_DAYS = 7;
const LONG_HALF_LIFE_DAYS = 21;
const COMPLETABILITY_SCALE_MINUTES = 8;

export const SCORE_WEIGHTS = {
  momentum: 0.35,
  completability: 0.25,
  interest: 0.2,
  affinity: 0.1,
  saved: 0.1,
} as const;

export type ScoreCandidate = {
  progress: number;
  maxProgress: number;
  activeReadMs: number;
  contentWords: number;
  lastReadAt: Date;
  isSaved: boolean;
  /** The feed's `viewed_item_count` for this user. Null for clips, which have no feed. */
  feedViewedItemCount: number | null;
};

export type ScoreContext = {
  now: Date;
  /** The user's largest `viewed_item_count` across feeds, the denominator of affinity. */
  maxFeedViewedItemCount: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Whole minutes left at the current position, the same figure clients display. */
export function remainingMinutesFor(contentWords: number, progress: number): number {
  return Math.ceil((contentWords * (1 - clamp01(progress))) / WORDS_PER_MINUTE);
}

function momentum(candidate: ScoreCandidate): number {
  return clamp01(candidate.maxProgress);
}

function completability(candidate: ScoreCandidate): number {
  const remaining = remainingMinutesFor(candidate.contentWords, candidate.progress);
  return 1 / (1 + remaining / COMPLETABILITY_SCALE_MINUTES);
}

function interest(candidate: ScoreCandidate): number {
  const expectedMs =
    ((candidate.contentWords * clamp01(candidate.maxProgress)) / WORDS_PER_MINUTE) * MS_PER_MINUTE;
  if (expectedMs <= 0) {
    return candidate.activeReadMs > 0 ? 1 : 0;
  }
  return Math.min(1, candidate.activeReadMs / expectedMs);
}

function affinity(candidate: ScoreCandidate, context: ScoreContext): number {
  if (candidate.feedViewedItemCount === null || context.maxFeedViewedItemCount <= 0) {
    return 0;
  }
  return clamp01(
    Math.log1p(candidate.feedViewedItemCount) / Math.log1p(context.maxFeedViewedItemCount),
  );
}

function freshness(candidate: ScoreCandidate, now: Date): number {
  const daysSinceLastRead = Math.max(0, (now.getTime() - candidate.lastReadAt.getTime()) / DAY_MS);
  const halfLifeDays =
    candidate.contentWords < SHORT_ARTICLE_WORDS ? SHORT_HALF_LIFE_DAYS : LONG_HALF_LIFE_DAYS;
  return 0.5 ** (daysSinceLastRead / halfLifeDays);
}

export function scoreCandidate(candidate: ScoreCandidate, context: ScoreContext): number {
  const blended =
    SCORE_WEIGHTS.momentum * momentum(candidate) +
    SCORE_WEIGHTS.completability * completability(candidate) +
    SCORE_WEIGHTS.interest * interest(candidate) +
    SCORE_WEIGHTS.affinity * affinity(candidate, context) +
    SCORE_WEIGHTS.saved * (candidate.isSaved ? 1 : 0);
  return freshness(candidate, context.now) * blended;
}
