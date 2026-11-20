import { Effect, Layer } from "effect";
import { getTableName } from "drizzle-orm";
import {
  fakeDb,
  fakeHttpClient,
  fakeQueue,
  recordingLogger,
  testConfig,
} from "@api-tests/support/layers";

/** Fake database and row builders shared by the extraction workflow tests. */

export const PERFORMANCE_DEV_LINEAR_FIXTURE = new URL(
  "../../../../../fixtures/articles/performance-dev-linear.html",
  import.meta.url,
);

export type CapturedRow = Record<string, unknown>;

export type FakeCacheRow = {
  id: string;
  urlKey: string;
  sourceUrl: string;
  finalUrl: string | null;
  contentHash: string | null;
  contentHtml: string | null;
  contentText: string | null;
  sanitizerVersion?: string | null;
  rawHtml?: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export function promiseQuery<T>(value: T) {
  const promise = Promise.resolve(value);
  return {
    returning: () => Promise.resolve(value),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

export function tableName(table: unknown): string {
  return getTableName(table as Parameters<typeof getTableName>[0]);
}

export function feedRow(overrides: CapturedRow = {}) {
  return {
    id: "item-1",
    title: "How's Linear so fast?",
    link: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    summary: "A technical breakdown.",
    content: null,
    contentHtml: "<p>Original feed summary</p>",
    contentText: "Original feed summary",
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
    publishedAt: new Date("2026-07-01T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: "https://example.com/feed.xml",
    feedSiteUrl: "https://example.com",
    feedTitle: "performance.dev",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    categories: [],
    ...overrides,
  };
}

export function cacheRow(overrides: Partial<FakeCacheRow> = {}): FakeCacheRow {
  const now = new Date();
  return {
    id: "article_extract_1",
    urlKey: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    sourceUrl: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    finalUrl: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    contentHash: "hash",
    contentHtml: "<article><p>Cached ready full text.</p></article>",
    contentText: "Cached ready full text.",
    status: "ready",
    errorCode: null,
    errorMessage: null,
    fetchedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function clipRow(overrides: CapturedRow = {}) {
  return {
    id: "clip-1",
    userId: "user-1",
    url: "https://93.184.216.34/how-is-linear-so-fast-a-technical-breakdown",
    title: "93.184.216.34",
    content: null,
    contentHtml: null,
    contentText: null,
    contentMarkdown: null,
    contentStatus: "pending",
    contentSource: "link_only",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    extractedContentHtml: null,
    extractedContentText: null,
    extractedContentStatus: "pending",
    extractedContentError: null,
    extractedContentUpdatedAt: null,
    note: null,
    isRead: false,
    isSaved: true,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function createExtractionDb(
  options: {
    item?: CapturedRow;
    clip?: CapturedRow | null;
    cache?: FakeCacheRow | null;
    /** Another request already claimed the article: the conditional pending UPDATE matches no row. */
    claimLost?: boolean;
  } = {},
) {
  const usesClip = Object.hasOwn(options, "clip");
  // Clip-only databases have no feed row; tests that read `db.item` always build a feed one.
  const item = (options.item ?? (usesClip ? null : feedRow())) as CapturedRow;
  const clip = options.clip ?? null;
  let cache = options.cache ?? null;
  const updates: Array<{ table: string; patch: CapturedRow }> = [];
  const cacheWrites: Array<{ values: CapturedRow; set: CapturedRow }> = [];

  const db = {
    item,
    clip,
    updates,
    cacheWrites,
    get cache() {
      return cache;
    },
    select: () => ({
      from: (table: unknown) => {
        const name = tableName(table);

        if (name === "feed_items") {
          return {
            leftJoin: () => ({
              innerJoin: () => ({
                leftJoin: () => ({
                  // Subscription, feed, user state, then reading state.
                  leftJoin: () => ({
                    where: () => ({
                      limit: () => Promise.resolve(item ? [item] : []),
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        if (name === "article_clips") {
          const filtered = {
            where: () => ({
              limit: () => Promise.resolve(clip ? [clip] : []),
            }),
          };
          // Clip detail left joins the reading state before filtering.
          return { ...filtered, leftJoin: () => filtered };
        }

        if (name === "article_extraction_cache") {
          return {
            where: () => ({
              limit: () => Promise.resolve(cache ? [cache] : []),
            }),
          };
        }

        if (name === "feed_item_category_assignments") {
          return {
            innerJoin: () => ({
              where: () => Promise.resolve([]),
            }),
          };
        }

        throw new Error(`Unexpected select from ${name}`);
      },
    }),
    update: (table: unknown) => ({
      set: (patch: CapturedRow) => {
        const name = tableName(table);
        const claimsPending = patch.extractedContentStatus === "pending";
        const matched = !(options.claimLost && claimsPending);
        updates.push({ table: name, patch });
        if (matched && name === "feed_items") {
          Object.assign(item, patch);
        }
        if (matched && name === "article_clips" && clip && !("extractedContentHtml" in patch)) {
          // The only guarded, title-only update path is the conditional title replacement;
          // the content update always applies unconditionally (asserted separately via `updates`).
          Object.assign(clip, patch);
        }
        return {
          where: () => promiseQuery(matched ? [{ id: (item ?? clip)?.id }] : []),
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (values: CapturedRow) => {
        const name = tableName(table);
        if (name !== "article_extraction_cache") {
          throw new Error(`Unexpected insert into ${name}`);
        }
        return {
          onConflictDoUpdate: ({ set }: { set: CapturedRow }) => {
            cacheWrites.push({ values, set });
            cache = {
              ...(cache ?? {}),
              ...values,
              ...set,
            } as FakeCacheRow;
            return promiseQuery([]);
          },
        };
      },
    }),
  };

  return db;
}

type ExtractionTestOptions = {
  /** Answers every outbound request; any request without one fails the test. */
  respond?: (request: { method: string; url: string }) => Response | Promise<Response>;
  /** Called with each XADD the job queue issues. */
  xadd?: (...args: unknown[]) => Promise<string>;
};

/**
 * The services the extraction workflow runs on: the fake database, a fake HTTP client, a fake
 * job-queue Redis and a recording logger. `requests` lists every outbound request.
 */
export function extractionServices(
  db: ReturnType<typeof createExtractionDb>,
  options: ExtractionTestOptions = {},
) {
  const requests: Array<{ method: string; url: string }> = [];
  const logs = recordingLogger();
  const layer = Layer.mergeAll(
    fakeDb(db as never),
    fakeQueue({ xadd: options.xadd ?? (async () => "1-0") }),
    fakeHttpClient((request) => {
      requests.push(request);
      if (!options.respond) {
        throw new Error(`unexpected outbound request: ${request.url}`);
      }
      return options.respond(request);
    }),
    testConfig(),
    logs.layer,
  );
  return { layer, requests, logs };
}

/** Run an extraction Effect against `extractionServices`. */
export function runExtraction<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  services: ReturnType<typeof extractionServices>,
) {
  return Effect.runPromise(Effect.provide(effect, services.layer) as Effect.Effect<A, E>);
}

/** The job a recorded XADD published: fields follow the `MAXLEN ~ n *` arguments. */
export function publishedJob(args: unknown[]): { type: string; payload: Record<string, unknown> } {
  const fields = args.slice(5) as string[];
  const byName = new Map<string, string>();
  for (let index = 0; index < fields.length; index += 2) {
    byName.set(fields[index]!, fields[index + 1]!);
  }
  return { type: byName.get("type")!, payload: JSON.parse(byName.get("payload")!) };
}
