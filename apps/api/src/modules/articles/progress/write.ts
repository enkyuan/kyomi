import type { articleReadingState } from "@kyomi/db";
import { htmlToText, type ArticleReaderContentDto } from "@modules/articles/reader/content";
import {
  applyProgressWrite,
  RESURFACE_CONFIG,
  type ScheduleFields,
} from "@modules/articles/resurface/schedule";
import type { ReadingProgressUpdateBody } from "./types";

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
