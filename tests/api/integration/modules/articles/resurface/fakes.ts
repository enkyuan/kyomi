import { articleClips, feedUserStats } from "@kyomi/db";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { ReadingStateRow } from "@modules/articles/progress/write";

export const NOW = new Date("2026-10-24T12:00:00.000Z");
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

export function renderSql(fragment: SQL): { sql: string; params: unknown[] } {
  return new PgDialect().sqlToQuery(fragment);
}

let sequence = 0;

/** An eligible feed-item reading row; override fields to make it ineligible. */
export function readingRow(overrides: Partial<ReadingStateRow> = {}): ReadingStateRow {
  sequence += 1;
  return {
    id: `rs-${sequence}`,
    userId: "user-1",
    feedItemId: `feed-item-${sequence}`,
    clipId: null,
    progress: 0.4,
    maxProgress: 0.4,
    anchor: null,
    contentKey: "feed_html:1",
    contentWords: 1_500,
    activeReadMs: 90_000,
    sessionCount: 1,
    lastSessionId: null,
    lastSessionActiveMs: 0,
    clientUpdatedAt: ago(2 * DAY),
    firstReadAt: ago(3 * DAY),
    lastReadAt: ago(2 * DAY),
    completedAt: null,
    state: "reading",
    dueAt: ago(DAY),
    intervalDays: 1,
    ease: 2,
    impressions: 0,
    lapses: 0,
    lastImpressionAt: null,
    dismissedAt: null,
    updatedAt: ago(2 * DAY),
    ...overrides,
  };
}

type FakeFeedCandidate = {
  reading: ReadingStateRow;
  id?: string;
  hiddenAt?: Date | null;
  isSaved?: boolean;
  viewedItemCount?: number | null;
};

export function feedCandidateRow(input: FakeFeedCandidate) {
  const id = input.id ?? input.reading.feedItemId ?? "feed-item";
  return {
    reading: input.reading,
    id,
    title: `Title ${id}`,
    link: `https://example.com/${id}`,
    summary: null,
    publishedAt: ago(10 * DAY),
    feedId: "feed-1",
    feedUrl: "https://example.com/feed.xml",
    feedSiteUrl: "https://example.com",
    feedTitle: "Example feed",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: input.isSaved ?? false,
    lastViewedAt: input.reading.lastReadAt,
    hiddenAt: input.hiddenAt ?? null,
    categories: [] as string[],
    viewedItemCount: input.viewedItemCount ?? 0,
  };
}

export function clipCandidateRow(reading: ReadingStateRow, id = reading.clipId ?? "clip") {
  return {
    reading,
    clip: {
      id,
      userId: reading.userId,
      url: `https://example.com/${id}`,
      title: `Clip ${id}`,
      note: null,
      isRead: false,
      isSaved: true,
      lastViewedAt: reading.lastReadAt,
      createdAt: ago(20 * DAY),
    },
  };
}

type ChainResult = unknown[];

type Recorded = {
  from: unknown;
  joins: unknown[];
  where: SQL | undefined;
  limit: number | undefined;
  lock: unknown;
};

/** A thenable query builder that records its clauses and resolves to canned rows. */
function chain(resolve: (recorded: Recorded) => ChainResult, sink: Recorded[]) {
  const recorded: Recorded = {
    from: undefined,
    joins: [],
    where: undefined,
    limit: undefined,
    lock: undefined,
  };
  sink.push(recorded);
  const builder: Record<string, unknown> = {
    from(table: unknown) {
      recorded.from = table;
      return builder;
    },
    innerJoin(table: unknown) {
      recorded.joins.push(table);
      return builder;
    },
    leftJoin(table: unknown) {
      recorded.joins.push(table);
      return builder;
    },
    where(condition: SQL) {
      recorded.where = condition;
      return builder;
    },
    orderBy() {
      return builder;
    },
    limit(value: number) {
      recorded.limit = value;
      return builder;
    },
    for(...args: unknown[]) {
      recorded.lock = args;
      return builder;
    },
    then(onFulfilled: (rows: ChainResult) => unknown, onRejected?: (error: unknown) => unknown) {
      return Promise.resolve(resolve(recorded)).then(onFulfilled, onRejected);
    },
  };
  return builder;
}

export type UpdateRecord = { set: Record<string, unknown>; where: SQL | undefined };

export function createViewDb(rows: {
  feed?: ReturnType<typeof feedCandidateRow>[];
  clips?: ReturnType<typeof clipCandidateRow>[];
  maxViewedItemCount?: number;
}) {
  const queries: Recorded[] = [];
  const resolve = (recorded: Recorded): ChainResult => {
    if (recorded.from === feedUserStats) {
      return rows.maxViewedItemCount === undefined
        ? []
        : [{ viewedItemCount: rows.maxViewedItemCount }];
    }
    if (recorded.joins.includes(articleClips)) {
      return rows.clips ?? [];
    }
    return rows.feed ?? [];
  };
  return { queries, db: { select: () => chain(resolve, queries) } };
}

/** A database whose transaction exposes locked reading rows and records the updates applied. */
export function createWriteDb(
  lockedRows: Array<{ reading: ReadingStateRow; hiddenAt?: Date | null }>,
) {
  const queries: Recorded[] = [];
  const updates: UpdateRecord[] = [];
  const tx = {
    select: () =>
      chain(
        () => lockedRows.map((row) => ({ reading: row.reading, hiddenAt: row.hiddenAt ?? null })),
        queries,
      ),
    update: () => ({
      set(set: Record<string, unknown>) {
        return {
          where(where: SQL) {
            updates.push({ set, where });
            return Promise.resolve();
          },
        };
      },
    }),
  };
  let transactions = 0;
  return {
    queries,
    updates,
    get transactions() {
      return transactions;
    },
    db: {
      transaction: async <T>(callback: (handle: typeof tx) => Promise<T>) => {
        transactions += 1;
        return callback(tx);
      },
    },
  };
}
