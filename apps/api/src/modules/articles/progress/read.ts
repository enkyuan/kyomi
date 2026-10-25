import type { db } from "@adapters/db/client";
import { articleClips, articleReadingState, feedItems } from "@kyomi/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { isEngaged } from "@modules/articles/resurface/schedule";
import { remainingMinutesFor as remainingMinutesForWords } from "@modules/articles/resurface/score";
import type {
  ReadingBlockAnchor,
  ReadingPositionDto,
  ReadingProgressDto,
  ReadingState,
} from "./types";

/**
 * Reading columns for list and detail selects that left join `article_reading_state`. Aliased with
 * a `reading` prefix so they cannot collide with article columns; every value is null when the
 * user has no row for the article. `readingLastReadAt` is NOT NULL in the table, so it doubles as
 * the "row exists" marker.
 */
export const readingProgressColumns = {
  readingProgress: articleReadingState.progress,
  readingMaxProgress: articleReadingState.maxProgress,
  readingState: articleReadingState.state,
  readingActiveReadMs: articleReadingState.activeReadMs,
  readingContentWords: articleReadingState.contentWords,
  readingLastReadAt: articleReadingState.lastReadAt,
  readingCompletedAt: articleReadingState.completedAt,
};

/** Extra columns for detail reads, which also restore the position. */
export const readingPositionColumns = {
  ...readingProgressColumns,
  readingAnchor: articleReadingState.anchor,
  readingContentKey: articleReadingState.contentKey,
  readingClientUpdatedAt: articleReadingState.clientUpdatedAt,
};

/** Optional so rows built without the join (tests, producers without reading data) map to null. */
export type ReadingProgressColumnsRow = {
  readingProgress?: number | null;
  readingMaxProgress?: number | null;
  readingState?: string | null;
  readingActiveReadMs?: number | null;
  readingContentWords?: number | null;
  readingLastReadAt?: Date | null;
  readingCompletedAt?: Date | null;
};

export type ReadingPositionColumnsRow = ReadingProgressColumnsRow & {
  readingAnchor?: unknown;
  readingContentKey?: string | null;
  readingClientUpdatedAt?: Date | null;
};

/** Left join condition for feed-item list and detail queries. */
export function feedReadingStateJoin(userId: string) {
  return and(
    eq(articleReadingState.feedItemId, feedItems.id),
    eq(articleReadingState.userId, userId),
  );
}

/** Left join condition for clip list and detail queries. */
export function clipReadingStateJoin(userId: string) {
  return and(
    eq(articleReadingState.clipId, articleClips.id),
    eq(articleReadingState.userId, userId),
  );
}

/**
 * Reading progress for a page of list items, keyed by article id. One indexed lookup per page
 * instead of a join: list queries sort before they limit, so a join would probe the reading-state
 * index once per candidate row rather than once per returned row.
 */
export async function loadReadingProgressByArticleId(
  database: typeof db,
  userId: string,
  articleIds: string[],
): Promise<Map<string, ReadingProgressDto>> {
  const result = new Map<string, ReadingProgressDto>();
  if (articleIds.length === 0) {
    return result;
  }
  const rows = await database
    .select({
      feedItemId: articleReadingState.feedItemId,
      clipId: articleReadingState.clipId,
      ...readingProgressColumns,
    })
    .from(articleReadingState)
    .where(
      and(
        eq(articleReadingState.userId, userId),
        or(
          inArray(articleReadingState.feedItemId, articleIds),
          inArray(articleReadingState.clipId, articleIds),
        ),
      ),
    );
  for (const row of rows) {
    const articleId = row.feedItemId ?? row.clipId;
    const dto = toReadingProgressDto(row);
    if (articleId && dto) {
      result.set(articleId, dto);
    }
  }
  return result;
}

/** Fills `readingProgress` on list items that were mapped without it. */
export async function attachReadingProgress<T extends { id: string }>(
  database: typeof db,
  userId: string,
  items: T[],
): Promise<(T & { readingProgress: ReadingProgressDto | null })[]> {
  const byId = await loadReadingProgressByArticleId(
    database,
    userId,
    items.map((item) => item.id),
  );
  return items.map((item) => ({ ...item, readingProgress: byId.get(item.id) ?? null }));
}

/** `ceil(words * (1 - progress) / 238)`, null when the word count is unknown. */
export function remainingMinutesFor(contentWords: number | null, progress: number): number | null {
  return contentWords === null ? null : remainingMinutesForWords(contentWords, progress);
}

export function toReadingProgressDtoFromFields(fields: {
  progress: number;
  maxProgress: number;
  state: string;
  activeReadMs: number;
  contentWords: number | null;
  lastReadAt: Date;
  completedAt: Date | null;
}): ReadingProgressDto {
  return {
    progress: fields.progress,
    maxProgress: fields.maxProgress,
    state: fields.state as ReadingState,
    engaged: isEngaged({ maxProgress: fields.maxProgress, activeReadMs: fields.activeReadMs }),
    remainingMinutes: remainingMinutesFor(fields.contentWords, fields.progress),
    lastReadAt: fields.lastReadAt.toISOString(),
    completedAt: fields.completedAt?.toISOString() ?? null,
  };
}

/** Maps the aliased join columns to the DTO; null when the left join found no row. */
export function toReadingProgressDto(row: ReadingProgressColumnsRow): ReadingProgressDto | null {
  if (row.readingLastReadAt == null) {
    return null;
  }
  return toReadingProgressDtoFromFields({
    progress: row.readingProgress ?? 0,
    maxProgress: row.readingMaxProgress ?? 0,
    state: row.readingState ?? "reading",
    activeReadMs: row.readingActiveReadMs ?? 0,
    contentWords: row.readingContentWords ?? null,
    lastReadAt: row.readingLastReadAt,
    completedAt: row.readingCompletedAt ?? null,
  });
}

function parseAnchor(value: unknown): ReadingBlockAnchor | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const anchor = value as Partial<ReadingBlockAnchor>;
  if (
    anchor.kind !== "block" ||
    typeof anchor.blockIndex !== "number" ||
    typeof anchor.offset !== "number" ||
    typeof anchor.fingerprint !== "string"
  ) {
    return null;
  }
  return {
    kind: "block",
    blockIndex: anchor.blockIndex,
    offset: anchor.offset,
    fingerprint: anchor.fingerprint,
  };
}

/** Maps the aliased detail columns to the restore position; null when no row exists. */
export function toReadingPositionDto(row: ReadingPositionColumnsRow): ReadingPositionDto | null {
  if (row.readingLastReadAt == null || row.readingContentKey == null) {
    return null;
  }
  return {
    progress: row.readingProgress ?? 0,
    anchor: parseAnchor(row.readingAnchor),
    contentKey: row.readingContentKey,
    updatedAt: (row.readingClientUpdatedAt ?? row.readingLastReadAt).toISOString(),
  };
}
