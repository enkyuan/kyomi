import { Effect } from "effect";
import { articleClips, articleReadingState, feedItems, userPreferences } from "@kyomi/db";
import { and, eq, or } from "drizzle-orm";
import { Db, type Database } from "@adapters/db/service";
import { Conflict } from "@shared/effect/errors";
import { currentDate } from "../clock";
import { articleNotFound } from "../errors";
import { getArticleDetail } from "../read/detail";
import { toReadingProgressDtoFromFields } from "./read";
import type { ReadingProgressDto, ReadingProgressUpdateBody } from "./types";
import { countContentWords, reduceProgressWrite, type ReadingStateRow } from "./write";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;
type ArticleKind = "feed" | "clip";

/** What the write transaction decided; failures are values so the Effect side types them. */
type PersistOutcome =
  | { status: "saved"; dto: ReadingProgressDto }
  | { status: "unknown_article" }
  | { status: "conflict" };

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
async function findArticleKind(
  database: Executor,
  userId: string,
  articleId: string,
): Promise<ArticleKind | null> {
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
  return items[0] ? "feed" : null;
}

type PersistInput = {
  userId: string;
  articleId: string;
  body: ReadingProgressUpdateBody;
  now: Date;
  /** Resolved before the transaction on a first write; null when a row existed at the peek. */
  kind: ArticleKind | null;
  contentWords: number | null;
};

/** The read-modify-write of one progress write, under a row lock so concurrent flushes serialize. */
function persistProgress(database: Database, input: PersistInput): Promise<PersistOutcome> {
  const { userId, articleId, body, now } = input;
  return database.transaction(async (tx): Promise<PersistOutcome> => {
    let prev = await findReadingState(tx, userId, articleId, true);

    if (!prev) {
      const kind = input.kind ?? (await findArticleKind(tx, userId, articleId));
      if (!kind) {
        return { status: "unknown_article" };
      }
      const values = reduceProgressWrite(null, body, now, input.contentWords);
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
        return { status: "saved", dto: rowToDto(inserted[0]) };
      }
      // A concurrent first write won the unique index; fold this one into its row.
      prev = await findReadingState(tx, userId, articleId, true);
      if (!prev) {
        return { status: "conflict" };
      }
    }

    const values = reduceProgressWrite(prev, body, now, null);
    const updated = await tx
      .update(articleReadingState)
      .set({ ...values, updatedAt: now })
      .where(eq(articleReadingState.id, prev.id))
      .returning();
    return { status: "saved", dto: rowToDto(updated[0] ?? prev) };
  });
}

/**
 * Applies one progress write and returns the resulting state. When the user turned off
 * "Remember reading position" the write changes nothing and returns the current state.
 */
export const writeArticleProgressForUser = Effect.fn("articles.progress.write")(function* (
  userId: string,
  articleId: string,
  body: ReadingProgressUpdateBody,
) {
  const db = yield* Db;
  const now = yield* currentDate;

  const resolveKind = db
    .use("articles.progress.resolve_kind", (client) => findArticleKind(client, userId, articleId))
    .pipe(Effect.flatMap((kind) => (kind ? Effect.succeed(kind) : articleNotFound())));

  const [enabled, peek] = yield* Effect.all(
    [
      db.use("articles.progress.preference", (client) => isRememberPositionEnabled(client, userId)),
      db.use("articles.progress.peek", (client) =>
        findReadingState(client, userId, articleId, false),
      ),
    ],
    { concurrency: 2 },
  );

  if (!enabled) {
    if (peek) {
      return rowToDto(peek);
    }
    yield* resolveKind;
    return emptyDto(now);
  }

  // Only the first write for an article pays for resolving it and counting its words.
  let kind: ArticleKind | null = null;
  let contentWords: number | null = null;
  if (!peek) {
    kind = yield* resolveKind;
    const detail = yield* getArticleDetail(userId, articleId);
    contentWords = countContentWords(detail.reader.selected);
  }

  const outcome = yield* db.use("articles.progress.persist", (client) =>
    persistProgress(client, { userId, articleId, body, now, kind, contentWords }),
  );
  switch (outcome.status) {
    case "saved":
      return outcome.dto;
    case "unknown_article":
      return yield* articleNotFound();
    case "conflict":
      return yield* new Conflict({
        message: "Reading state conflict",
        code: "READING_STATE_CONFLICT",
      });
  }
});
