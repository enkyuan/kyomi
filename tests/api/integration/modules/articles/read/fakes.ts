import { PgDialect } from "drizzle-orm/pg-core";
import type { toFeedArticleDetailDto } from "@modules/articles/read/detail";
import type { Layer } from "effect";
import type { Db } from "@adapters/db/service";
import { fakeDb } from "@api-tests/support/layers";

/**
 * A Drizzle fake for the read-side queries. Every `select(...)` call takes the next result set in
 * order; the builder chain accepts any method (`from`, `innerJoin`, `where`, ...) and is awaitable.
 * Each call records its chain of method names and its `where` condition, so tests can assert the
 * shape of the query without a database.
 */
export type SelectCall = {
  /** Method names in call order, e.g. `["from", "innerJoin", "leftJoin", "where"]`. */
  readonly chain: string[];
  readonly where?: unknown;
};

const dialect = new PgDialect();

export function renderWhere(call: SelectCall | undefined) {
  if (!call?.where) {
    throw new Error("select call has no where condition");
  }
  return dialect.sqlToQuery(call.where as Parameters<PgDialect["sqlToQuery"]>[0]);
}

/** The first argument of `select(...)`: the selected fields, absent for `select()`. */
export type SelectFields = Record<string, unknown> | undefined;

/** `selectResults`, but each `select` is answered by `respond(fields)` instead of by call order. */
export function selectBy(respond: (fields: SelectFields) => unknown[]) {
  return fakeSelect(respond);
}

/** Every `select(...)` call takes the next result set, in call order. */
export function selectResults(...results: unknown[][]) {
  const queue = [...results];
  return fakeSelect(() => queue.shift() ?? []);
}

function fakeSelect(respond: (fields: SelectFields) => unknown[]) {
  const calls: SelectCall[] = [];
  const select = (fields?: SelectFields) => {
    const call: { chain: string[]; where?: unknown } = { chain: [] };
    calls.push(call);
    const next = respond(fields);
    const builder: object = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "then") {
            return (resolve: (rows: unknown[]) => unknown, reject?: (cause: unknown) => unknown) =>
              Promise.resolve(next).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            call.chain.push(String(property));
            if (property === "where") {
              call.where = args[0];
            }
            return builder;
          };
        },
      },
    );
    return builder;
  };
  return { calls, select, layer: fakeDb({ select }) };
}

type FeedDetailRow = Parameters<typeof toFeedArticleDetailDto>[0];

/** A feed item row as the detail query selects it. */
export function rawDetailRow(overrides: Partial<FeedDetailRow> = {}): FeedDetailRow {
  return {
    id: "item-1",
    title: "SearXNG: A free internet metasearch engine",
    link: "https://searxng.org/",
    summary: "Summary",
    imageUrl: "https://searxng.org/og-image.png",
    content: null,
    contentHtml: "<p>Summary</p>",
    contentSanitizerVersion: null,
    contentText: "Summary",
    contentMarkdown: null,
    contentStatus: "ready",
    contentSource: "feed_html",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    extractedContentHtml: null,
    extractedContentText: null,
    extractedContentStatus: "pending",
    extractedContentError: null,
    extractedContentUpdatedAt: null,
    extractedContentSanitizerVersion: null,
    publishedAt: new Date("2026-07-04T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: "https://news.ycombinator.com/rss",
    feedSiteUrl: "https://news.ycombinator.com",
    feedTitle: "Hacker News",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    lastViewedAt: null,
    categories: [],
    ...overrides,
  };
}
