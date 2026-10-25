import type { db } from "@adapters/db/client";
import { articleClips, articleReadingState, feedItems, userPreferences } from "@kyomi/db";
import { and, eq, or } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import { getArticleDetailForUser } from "@modules/articles/read/detail";
import { htmlToText, type ArticleReaderContentDto } from "@modules/articles/reader/content";
import {
  applyProgressWrite,
  RESURFACE_CONFIG,
  type ScheduleFields,
} from "@modules/articles/resurface/schedule";
import { toReadingProgressDtoFromFields } from "./read";
import type { ReadingProgressDto, ReadingProgressUpdateBody } from "./types";

type DB = typeof db;
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type Executor = DB | Tx;

export type ReadingStateRow = typeof articleReadingState.$inferSelect;

/** Slack added to the wall-clock bound on every accepted write (flush jitter, timer rounding). */
export const ACTIVE_TIME_SLACK_MS = 5_000;
/**
 * Wall-clock bound for the first write of an article, which has no previous write to measure
 * from. Clients flush every 10 s, so one minute covers a delayed first flush.
 */
export const FIRST_WRITE_WALL_MS = 60_000;

const INT4_MAX = 2_147_483_647;

/** Columns a write may change; identity columns are set once on insert. */
export type ReadingStateValues = Omit<
  ReadingStateRow,
  "id" | "userId" | "feedItemId" | "clipId" | "updatedAt"
>;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Word count of the reader content the server selected for this article. */
export function countContentWords(selected: ArticleReaderContentDto): number {
  if (selected.bodyKind === "fallback") {
    return countWords(selected.fallbackSummary ?? "");
  }
  if (selected.contentText) {
    return countWords(selected.contentText);
  }
  if (selected.bodyKind === "html") {
    return countWords(htmlToText(selected.contentHtml));
  }
  if (selected.bodyKind === "markdown") {
    return countWords(selected.contentMarkdown);
  }
  return countWords(selected.contentText ?? "");
}

export function scheduleFieldsOf(row: ReadingStateRow): ScheduleFields {
  return {
    state: row.state as ScheduleFields["state"],
    dueAt: row.dueAt,
    intervalDays: row.intervalDays,
    ease: row.ease,
    impressions: row.impressions,
    lapses: row.lapses,
    lastImpressionAt: row.lastImpressionAt,
    dismissedAt: row.dismissedAt,
  };
}

function parseClientUpdatedAt(value: string, now: Date): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return now;
  }
  // A client clock ahead of the server must not win every later last-write-wins comparison.
  return parsed.getTime() > now.getTime() ? now : parsed;
}

/** Last-write-wins on the client clock: a write older than the stored one keeps the position. */
function reducePosition(
  prev: ReadingStateRow | null,
  body: ReadingProgressUpdateBody,
  now: Date,
): Pick<ReadingStateValues, "progress" | "anchor" | "contentKey" | "clientUpdatedAt"> {
  const clientAt = parseClientUpdatedAt(body.clientUpdatedAt, now);
  if (prev?.clientUpdatedAt && clientAt.getTime() < prev.clientUpdatedAt.getTime()) {
    return {
      progress: prev.progress,
      anchor: prev.anchor,
      contentKey: prev.contentKey,
      clientUpdatedAt: prev.clientUpdatedAt,
    };
  }
  return {
    progress: body.progress,
    anchor: body.anchor,
    contentKey: body.contentKey,
    clientUpdatedAt: clientAt,
  };
}

/** Credits active time once per session, never more than the wall time since the last write. */
function reduceActiveTime(
  prev: ReadingStateRow | null,
  body: ReadingProgressUpdateBody,
  now: Date,
): { isNewSession: boolean } & Pick<
  ReadingStateValues,
  "activeReadMs" | "sessionCount" | "lastSessionActiveMs"
> {
  const isNewSession = prev === null || prev.lastSessionId !== body.sessionId;
  const storedSessionActiveMs = isNewSession ? 0 : prev.lastSessionActiveMs;
  const rawDelta = Math.max(0, body.sessionActiveMs - storedSessionActiveMs);
  const wallMs =
    prev === null ? FIRST_WRITE_WALL_MS : Math.max(0, now.getTime() - prev.lastReadAt.getTime());
  const delta = Math.min(rawDelta, wallMs + ACTIVE_TIME_SLACK_MS);

  return {
    isNewSession,
    activeReadMs: Math.min(INT4_MAX, (prev?.activeReadMs ?? 0) + delta),
    sessionCount: (prev?.sessionCount ?? 0) + (isNewSession ? 1 : 0),
    // Stored as reported, not as credited, so a retry of the same cumulative value adds nothing.
    lastSessionActiveMs: Math.max(storedSessionActiveMs, body.sessionActiveMs),
  };
}

/**
 * Pure reducer for one progress write. `prev` is the stored row or null for the first write;
 * `contentWords` is only read on the first write and is kept afterwards.
 */
export function reduceProgressWrite(
  prev: ReadingStateRow | null,
  body: ReadingProgressUpdateBody,
  now: Date,
  contentWords: number | null,
): ReadingStateValues {
  const { isNewSession, ...activeTime } = reduceActiveTime(prev, body, now);
  const completedNow = body.completed || body.progress >= RESURFACE_CONFIG.completeThreshold;

  const schedule = applyProgressWrite(prev === null ? null : scheduleFieldsOf(prev), {
    isNewSession,
    completed: completedNow,
    lastReadAt: now,
    now,
  });

  return {
    ...reducePosition(prev, body, now),
    ...activeTime,
    maxProgress: Math.max(prev?.maxProgress ?? 0, body.progress),
    contentWords: prev === null ? contentWords : prev.contentWords,
    lastSessionId: body.sessionId,
    firstReadAt: prev?.firstReadAt ?? now,
    lastReadAt: now,
    completedAt: prev?.completedAt ?? (completedNow ? now : null),
    state: schedule.state,
    dueAt: schedule.dueAt,
    intervalDays: schedule.intervalDays,
    ease: schedule.ease,
    impressions: schedule.impressions,
    lapses: schedule.lapses,
    lastImpressionAt: schedule.lastImpressionAt,
    dismissedAt: schedule.dismissedAt,
  };
}

function rowToDto(row: ReadingStateRow): ReadingProgressDto {
  return toReadingProgressDtoFromFields(row);
}

/** What a no-op write returns when the user has no row yet. */
function emptyDto(now: Date): ReadingProgressDto {
  return {
    progress: 0,
    maxProgress: 0,
    state: "reading",
    engaged: false,
    remainingMinutes: null,
    lastReadAt: now.toISOString(),
    completedAt: null,
  };
}

async function isRememberPositionEnabled(database: Executor, userId: string): Promise<boolean> {
  const rows = await database
    .select({ enabled: userPreferences.readerRememberPosition })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);
  return rows[0]?.enabled ?? true;
}

function ownRowFilter(userId: string, articleId: string) {
  return and(
    eq(articleReadingState.userId, userId),
    or(eq(articleReadingState.feedItemId, articleId), eq(articleReadingState.clipId, articleId)),
  );
}

async function findReadingState(
  database: Executor,
  userId: string,
  articleId: string,
  lock: boolean,
): Promise<ReadingStateRow | null> {
  const query = database
    .select()
    .from(articleReadingState)
    .where(ownRowFilter(userId, articleId))
    .limit(1);
  if (lock) {
    return (await query.for("update"))[0] ?? null;
  }
  return (await query)[0] ?? null;
}

/** Same authorization as `POST /articles/:articleId/view`: own clips, or any existing feed item. */
async function resolveArticleKind(
  database: Executor,
  userId: string,
  articleId: string,
): Promise<"feed" | "clip"> {
  const clips = await database
    .select({ id: articleClips.id })
    .from(articleClips)
    .where(and(eq(articleClips.id, articleId), eq(articleClips.userId, userId)))
    .limit(1);
  if (clips[0]) {
    return "clip";
  }
  const items = await database
    .select({ id: feedItems.id })
    .from(feedItems)
    .where(eq(feedItems.id, articleId))
    .limit(1);
  if (items[0]) {
    return "feed";
  }
  throw new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" });
}

async function loadContentWords(database: DB, userId: string, articleId: string): Promise<number> {
  const detail = await getArticleDetailForUser(database, userId, articleId);
  return countContentWords(detail.reader.selected);
}

/**
 * Applies one progress write and returns the resulting state. When the user turned off
 * "Remember reading position" the write changes nothing and returns the current state.
 */
export async function writeArticleProgressForUser(
  database: DB,
  userId: string,
  articleId: string,
  body: ReadingProgressUpdateBody,
  now: Date = new Date(),
): Promise<ReadingProgressDto> {
  const enabled = await isRememberPositionEnabled(database, userId);
  const peek = await findReadingState(database, userId, articleId, false);

  if (!enabled) {
    if (peek) {
      return rowToDto(peek);
    }
    await resolveArticleKind(database, userId, articleId);
    return emptyDto(now);
  }

  // Only the first write for an article pays for resolving it and counting its words.
  let kind: "feed" | "clip" | null = null;
  let contentWords: number | null = null;
  if (!peek) {
    kind = await resolveArticleKind(database, userId, articleId);
    contentWords = await loadContentWords(database, userId, articleId);
  }

  return database.transaction(async (tx) => {
    let prev = await findReadingState(tx, userId, articleId, true);

    if (!prev) {
      kind ??= await resolveArticleKind(tx, userId, articleId);
      const values = reduceProgressWrite(null, body, now, contentWords);
      const inserted = await tx
        .insert(articleReadingState)
        .values({
          id: crypto.randomUUID(),
          userId,
          feedItemId: kind === "feed" ? articleId : null,
          clipId: kind === "clip" ? articleId : null,
          ...values,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
      if (inserted[0]) {
        return rowToDto(inserted[0]);
      }
      // A concurrent first write won the unique index; fold this one into its row.
      prev = await findReadingState(tx, userId, articleId, true);
      if (!prev) {
        throw new AppError("Reading state conflict", {
          status: 409,
          code: "READING_STATE_CONFLICT",
        });
      }
    }

    const values = reduceProgressWrite(prev, body, now, null);
    const updated = await tx
      .update(articleReadingState)
      .set({ ...values, updatedAt: now })
      .where(eq(articleReadingState.id, prev.id))
      .returning();
    return rowToDto(updated[0] ?? prev);
  });
}
