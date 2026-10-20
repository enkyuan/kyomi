import { getTableName } from "drizzle-orm";

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
  options: { item?: CapturedRow; clip?: CapturedRow | null; cache?: FakeCacheRow | null } = {},
) {
  const usesClip = Object.hasOwn(options, "clip");
  const item = options.item ?? (usesClip ? null : feedRow());
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
                  where: () => ({
                    limit: () => Promise.resolve(item ? [item] : []),
                  }),
                }),
              }),
            }),
          };
        }

        if (name === "article_clips") {
          return {
            where: () => ({
              limit: () => Promise.resolve(clip ? [clip] : []),
            }),
          };
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
        updates.push({ table: name, patch });
        if (name === "feed_items") {
          Object.assign(item, patch);
        }
        if (name === "article_clips" && clip && !("extractedContentHtml" in patch)) {
          // The only guarded, title-only update path is the conditional title replacement;
          // the content update always applies unconditionally (asserted separately via `updates`).
          Object.assign(clip, patch);
        }
        return {
          where: () => Promise.resolve(),
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
