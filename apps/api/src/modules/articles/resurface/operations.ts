import { Effect } from "effect";
import { articleReadingState } from "@kyomi/db";
import { eq } from "drizzle-orm";
import { Db, type Database } from "@adapters/db/service";
import { currentDate } from "@shared/effect/clock";
import { articleNotFound } from "@modules/articles/errors";
import { toReadingProgressDtoFromFields } from "@modules/articles/progress/read";
import { scheduleFieldsOf, type ReadingStateRow } from "@modules/articles/progress/write";
import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "@modules/articles/types";
import { CurrentUser } from "@shared/effect/request";
import {
  getMaxFeedViewedItemCount,
  listClipCandidates,
  listFeedCandidates,
  lockReadingRows,
} from "./queries";
import { applyDismiss, applyImpression, isEligible, type ScheduleFields } from "./schedule";
import { scoreCandidate } from "./score";
import type { ContinueReadingCandidate } from "./types";

export const DEFAULT_CONTINUE_READING_LIMIT = 5;
export const MAX_CONTINUE_READING_LIMIT = 20;

export function normalizeContinueReadingLimit(value: string | number | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CONTINUE_READING_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_CONTINUE_READING_LIMIT);
}

function isCandidateEligible(candidate: ContinueReadingCandidate, now: Date): boolean {
  const { reading } = candidate;
  return isEligible(
    {
      ...scheduleFieldsOf(reading),
      maxProgress: reading.maxProgress,
      activeReadMs: reading.activeReadMs,
      contentWords: reading.contentWords,
      lastReadAt: reading.lastReadAt,
      isHidden: candidate.isHidden,
    },
    now,
  );
}

/**
 * Ranks the eligible candidates and returns the best `limit`. Ties fall back to the earliest due
 * time and then the id so the order is stable across requests.
 */
export function rankContinueReading(
  candidates: readonly ContinueReadingCandidate[],
  options: { now: Date; limit: number; maxFeedViewedItemCount: number },
): ContinueReadingCandidate[] {
  const { now, limit, maxFeedViewedItemCount } = options;
  return candidates
    .filter((candidate) => isCandidateEligible(candidate, now))
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(
        {
          progress: candidate.reading.progress,
          maxProgress: candidate.reading.maxProgress,
          activeReadMs: candidate.reading.activeReadMs,
          // Eligibility guarantees a measured word count.
          contentWords: candidate.reading.contentWords ?? 0,
          lastReadAt: candidate.reading.lastReadAt,
          isSaved: candidate.isSaved,
          feedViewedItemCount: candidate.feedViewedItemCount,
        },
        { now, maxFeedViewedItemCount },
      ),
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        (left.candidate.reading.dueAt?.getTime() ?? 0) -
          (right.candidate.reading.dueAt?.getTime() ?? 0) ||
        left.candidate.item.id.localeCompare(right.candidate.item.id),
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

function toListItem(candidate: ContinueReadingCandidate): ArticleListItemDto {
  return {
    ...candidate.item,
    readingProgress: toReadingProgressDtoFromFields(candidate.reading),
  };
}

/** The three reads run side by side, one pool connection each. */
const CANDIDATE_READ_CONCURRENCY = 3;

export const listContinueReading = Effect.fn("articles.resurface.list")(function* (limit: number) {
  const { userId } = yield* CurrentUser;
  const now = yield* currentDate;
  const [feed, clips, maxFeedViewedItemCount] = yield* Effect.all(
    [
      listFeedCandidates(userId, now),
      listClipCandidates(userId, now),
      getMaxFeedViewedItemCount(userId),
    ],
    { concurrency: CANDIDATE_READ_CONCURRENCY },
  );
  const top = rankContinueReading([...feed, ...clips], { now, limit, maxFeedViewedItemCount });
  const response: ArticlesCursorListResponseDto = {
    items: top.map(toListItem),
    next_cursor: null,
    has_more: false,
    total_count: null,
  };
  return response;
});

async function persistSchedule(
  tx: Pick<Database, "update">,
  id: string,
  next: ScheduleFields,
  now: Date,
): Promise<void> {
  await tx
    .update(articleReadingState)
    .set({
      state: next.state,
      dueAt: next.dueAt,
      intervalDays: next.intervalDays,
      ease: next.ease,
      impressions: next.impressions,
      lapses: next.lapses,
      lastImpressionAt: next.lastImpressionAt,
      dismissedAt: next.dismissedAt,
      updatedAt: now,
    })
    .where(eq(articleReadingState.id, id));
}

/** The schedule after showing a locked row in Continue reading, or null when nothing changes. */
function scheduleAfterImpression(
  reading: ReadingStateRow,
  isHidden: boolean,
  now: Date,
): ScheduleFields | null {
  const prev = scheduleFieldsOf(reading);
  const eligible = isEligible(
    {
      ...prev,
      maxProgress: reading.maxProgress,
      activeReadMs: reading.activeReadMs,
      contentWords: reading.contentWords,
      lastReadAt: reading.lastReadAt,
      isHidden,
    },
    now,
  );
  if (!eligible) {
    return null;
  }
  // `applyImpression` returns its input when the impression repeats one inside the cooldown.
  const next = applyImpression(prev, now);
  return next === prev ? null : next;
}

/**
 * Records that the user saw these articles in Continue reading. Only the caller's own eligible
 * rows are touched; unknown, foreign, ineligible, and recently counted ids are ignored, so a
 * repeated report inside the cooldown changes nothing. Returns how many rows were scheduled.
 */
export const recordContinueReadingImpressions = Effect.fn("articles.resurface.recordImpressions")(
  function* (articleIds: readonly string[]) {
    const { userId } = yield* CurrentUser;
    const db = yield* Db;
    const now = yield* currentDate;
    const uniqueIds = [...new Set(articleIds)];
    return yield* db.use("articles.resurface.record_impressions", (client) =>
      client.transaction(async (tx) => {
        const rows = await lockReadingRows(tx, userId, uniqueIds);
        let applied = 0;
        for (const { reading, isHidden } of rows) {
          const next = scheduleAfterImpression(reading, isHidden, now);
          if (next) {
            await persistSchedule(tx, reading.id, next, now);
            applied += 1;
          }
        }
        return applied;
      }),
    );
  },
);

/** Stops resurfacing one of the caller's articles. Idempotent; unknown or foreign ids are 404. */
export const dismissContinueReading = Effect.fn("articles.resurface.dismiss")(function* (
  articleId: string,
) {
  const { userId } = yield* CurrentUser;
  const db = yield* Db;
  const now = yield* currentDate;
  const found = yield* db.use("articles.resurface.dismiss", (client) =>
    client.transaction(async (tx) => {
      const [row] = await lockReadingRows(tx, userId, [articleId]);
      if (!row) {
        return false;
      }
      const prev = scheduleFieldsOf(row.reading);
      const next = applyDismiss(prev, now);
      if (next !== prev) {
        await persistSchedule(tx, row.reading.id, next, now);
      }
      return true;
    }),
  );
  if (!found) {
    return yield* articleNotFound();
  }
});
