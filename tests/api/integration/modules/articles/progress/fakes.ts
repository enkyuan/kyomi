import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

/**
 * In-memory stand-in for the Drizzle database used by the progress write tests. It keeps reading
 * state rows, clips, feed items and preferences, and resolves each `where` by the bound parameters
 * of its SQL so that ownership filters (`user_id = ?`, `id = ?`) still decide what a query sees.
 */

type Row = Record<string, unknown>;

function toCamel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

const dialect = new PgDialect();

function paramsOf(condition: unknown): unknown[] {
  if (!condition) {
    return [];
  }
  return dialect.sqlToQuery(condition as Parameters<PgDialect["sqlToQuery"]>[0]).params;
}

export type FakeProgressDbOptions = {
  clips?: Row[];
  feedItems?: Row[];
  preferences?: Row[];
  readingStates?: Row[];
};

export function createProgressDb(options: FakeProgressDbOptions = {}) {
  const tables: Record<string, Row[]> = {
    article_clips: options.clips ?? [],
    feed_items: options.feedItems ?? [],
    user_preferences: options.preferences ?? [],
    article_reading_state: options.readingStates ?? [],
  };
  const inserts: Row[] = [];
  const updates: Row[] = [];

  function select(name: string, fields: Record<string, unknown> | undefined) {
    let params: unknown[] = [];
    const chain = {
      leftJoin: () => chain,
      innerJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      for: () => chain,
      where: (condition: unknown) => {
        params = paramsOf(condition);
        return chain;
      },
      then: (resolve: (rows: Row[]) => unknown, reject?: (error: unknown) => unknown) => {
        const rows = (tables[name] ?? []).filter((row) => matches(name, row, params));
        return Promise.resolve(rows.map((row) => project(row, fields))).then(resolve, reject);
      },
    };
    return chain;
  }

  /** Mirrors `select({ alias: column })`: each alias reads the row property of its column. */
  function project(row: Row, fields: Record<string, unknown> | undefined): Row {
    if (!fields) {
      return row;
    }
    const projected: Row = {};
    for (const [alias, column] of Object.entries(fields)) {
      const columnName = (column as { name?: unknown }).name;
      // SQL expressions (isRead, categories) have no column; the fixture row supplies them by alias.
      projected[alias] = typeof columnName === "string" ? row[toCamel(columnName)] : row[alias];
    }
    return { ...row, ...projected };
  }

  /**
   * A row matches when its owner is bound in the query and, if the query names any row id of the
   * table, when it is one of the named ids.
   */
  function matches(name: string, row: Row, params: unknown[]): boolean {
    if (params.length === 0) {
      return true;
    }
    const ownerOk = !("userId" in row) || params.includes(row.userId);
    const ids = tables[name]!.flatMap((candidate) => [
      candidate.id,
      candidate.feedItemId,
      candidate.clipId,
    ]);
    const named = params.filter((param) => ids.includes(param));
    const rowIds = [row.id, row.feedItemId, row.clipId];
    const idOk = named.length === 0 || named.some((param) => rowIds.includes(param));
    return ownerOk && idOk;
  }

  const db = {
    inserts,
    updates,
    readingStates: tables.article_reading_state,
    select: (fields?: Record<string, unknown>) => ({
      from: (table: unknown) => select(getTableName(table as never), fields),
    }),
    insert: (table: unknown) => ({
      values: (values: Row) => {
        const name = getTableName(table as never);
        const insert = () => {
          inserts.push({ table: name, ...values });
          tables[name]!.push(values);
          return [values];
        };
        return {
          onConflictDoNothing: () => ({ returning: () => Promise.resolve(insert()) }),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (patch: Row) => ({
        where: (condition: unknown) => ({
          returning: () => {
            const name = getTableName(table as never);
            const params = paramsOf(condition);
            const rows = tables[name]!.filter((row) => params.includes(row.id));
            for (const row of rows) {
              Object.assign(row, patch);
            }
            updates.push({ table: name, ...patch });
            return Promise.resolve(rows);
          },
        }),
      }),
    }),
    transaction: <T>(run: (tx: unknown) => Promise<T>) => run(db),
  };
  return db;
}

const T0 = new Date("2026-10-01T10:00:00.000Z");
export const NOW = T0;

export function atMs(offsetMs: number): Date {
  return new Date(T0.getTime() + offsetMs);
}

export const ARTICLE_WORDS = Array.from({ length: 1_000 }, (_, index) => `word${index}`).join(" ");

export function feedItemRow(overrides: Row = {}): Row {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "A long read",
    link: "https://example.com/a",
    summary: "Summary",
    imageUrl: null,
    content: null,
    contentHtml: null,
    contentSanitizerVersion: null,
    contentText: ARTICLE_WORDS,
    contentMarkdown: null,
    contentStatus: "ready",
    contentSource: "text_fallback",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    extractedContentHtml: null,
    extractedContentText: null,
    extractedContentStatus: "pending",
    extractedContentError: null,
    extractedContentUpdatedAt: null,
    extractedContentSanitizerVersion: null,
    publishedAt: new Date("2026-09-30T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: "https://example.com/rss",
    feedSiteUrl: "https://example.com",
    feedTitle: "Example",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    lastViewedAt: null,
    categories: [],
    ...overrides,
  };
}

export function clipRow(overrides: Row = {}): Row {
  return {
    id: "00000000-0000-4000-8000-0000000000c1",
    userId: "user-1",
    url: "https://example.com/clip",
    title: "Clip",
    content: null,
    contentHtml: null,
    contentSanitizerVersion: null,
    contentText: ARTICLE_WORDS,
    contentMarkdown: null,
    contentStatus: "ready",
    contentSource: "text_fallback",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    extractedContentHtml: null,
    extractedContentText: null,
    extractedContentStatus: "pending",
    extractedContentError: null,
    extractedContentUpdatedAt: null,
    extractedContentSanitizerVersion: null,
    note: null,
    isRead: false,
    isSaved: true,
    savedAt: null,
    lastViewedAt: null,
    createdAt: new Date("2026-09-30T00:00:00.000Z"),
    updatedAt: new Date("2026-09-30T00:00:00.000Z"),
    ...overrides,
  };
}
