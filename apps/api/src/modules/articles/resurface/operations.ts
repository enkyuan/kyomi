import type { db } from "@adapters/db/client";
import { articleReadingState } from "@kyomi/db";
import { eq } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import type { ArticleListItemDto, ArticlesCursorListResponseDto } from "@modules/articles/types";
import { toReadingProgressDtoFromFields } from "@modules/articles/progress/read";
import { scheduleFieldsOf } from "@modules/articles/progress/write";
import {
  getMaxFeedViewedItemCount,
  listClipCandidates,
  listFeedCandidates,
  lockReadingRows,
} from "./queries";
import { applyDismiss, applyImpression, isEligible, type ScheduleFields } from "./schedule";
import { scoreCandidate } from "./score";
import type { ContinueReadingCandidate } from "./types";

type DB = typeof db;

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

export async function listContinueReading(
  database: DB,
  userId: string,
  limit: number,
  now: Date = new Date(),
): Promise<ArticlesCursorListResponseDto> {
  const [feed, clips, maxFeedViewedItemCount] = await Promise.all([
    listFeedCandidates(database, userId, now),
    listClipCandidates(database, userId, now),
    getMaxFeedViewedItemCount(database, userId),
  ]);
  const top = rankContinueReading([...feed, ...clips], { now, limit, maxFeedViewedItemCount });
  return { items: top.map(toListItem), next_cursor: null, has_more: false, total_count: null };
}

function changed(prev: ScheduleFields, next: ScheduleFields): boolean {
  return prev !== next;
}

async function persistSchedule(
  tx: Pick<DB, "update">,
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

/**
 * Records that the user saw these articles in Continue reading. Only the caller's own eligible
 * rows are touched; unknown, foreign, ineligible, and recently counted ids are ignored, so a
 * repeated report inside the cooldown changes nothing. Returns how many rows were scheduled.
 */
export async function recordContinueReadingImpressions(
  database: DB,
  userId: string,
  articleIds: readonly string[],
  now: Date = new Date(),
): Promise<number> {
  const uniqueIds = [...new Set(articleIds)];
  return database.transaction(async (tx) => {
    const rows = await lockReadingRows(tx, userId, uniqueIds);
    let applied = 0;
    for (const { reading, isHidden } of rows) {
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
        continue;
      }
      const next = applyImpression(prev, now);
      if (!changed(prev, next)) {
        continue;
      }
      await persistSchedule(tx, reading.id, next, now);
      applied += 1;
    }
    return applied;
  });
}

/** Stops resurfacing one of the caller's articles. Idempotent; unknown or foreign ids are 404. */
export async function dismissContinueReading(
  database: DB,
  userId: string,
  articleId: string,
  now: Date = new Date(),
): Promise<void> {
  await database.transaction(async (tx) => {
    const [row] = await lockReadingRows(tx, userId, [articleId]);
    if (!row) {
      throw new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" });
    }
    const prev = scheduleFieldsOf(row.reading);
    const next = applyDismiss(prev, now);
    if (changed(prev, next)) {
      await persistSchedule(tx, row.reading.id, next, now);
    }
  });
}
