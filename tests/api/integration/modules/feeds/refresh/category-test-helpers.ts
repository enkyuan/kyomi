import { getTableName } from "drizzle-orm";
import {
  CLASSIFIER_TAXONOMY_VERSION,
  KEYWORD_CLASSIFIER_METHOD,
  KEYWORD_CLASSIFIER_MODEL_ID,
  type ClassifierModelInfo,
} from "@kyomi/worker";

export const KEYWORD_MODEL: ClassifierModelInfo = {
  modelId: KEYWORD_CLASSIFIER_MODEL_ID,
  taxonomyVersion: CLASSIFIER_TAXONOMY_VERSION,
  classifierMethod: KEYWORD_CLASSIFIER_METHOD,
};

const originalFetch = globalThis.fetch;

export function mockFetch(handler: () => Response | Promise<Response>): typeof fetch {
  return handler as unknown as typeof fetch;
}

export function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

export type CapturedRow = Record<string, unknown>;

function promiseQuery<T>(value: T) {
  const promise = Promise.resolve(value);
  return {
    returning: () => Promise.resolve(value),
    then: promise.then.bind(promise),
    catch: promise.catch.bind(promise),
    finally: promise.finally.bind(promise),
  };
}

function tableName(table: unknown): string {
  return getTableName(table as Parameters<typeof getTableName>[0]);
}

export function createFeedRefreshDb(
  options: { feed?: CapturedRow; existingFeedCategoryAssignments?: CapturedRow[] } = {},
) {
  const feed = options.feed ?? {
    id: "feed-1",
    url: "https://example.com/feed.xml",
    link: "https://example.com/",
    title: "Example Feed",
    description: "Updates",
    faviconUrl: "https://example.com/favicon.ico",
    faviconSource: "html_link",
    etag: null,
    lastModified: null,
    lastRefreshSucceededAt: null,
    lastRefreshFailedAt: null,
  };
  const updates: Array<{ table: string; patch: CapturedRow }> = [];
  const deletes: string[] = [];
  const categories: CapturedRow[] = [];
  const feedItems: CapturedRow[] = [];
  const feedCategoryAssignments: CapturedRow[] = [
    ...(options.existingFeedCategoryAssignments ?? []),
  ];
  const feedItemCategoryAssignments: CapturedRow[] = [];
  const feedItemTagAssignments: CapturedRow[] = [];

  const db = {
    updates,
    deletes,
    categories,
    feedItems,
    feedCategoryAssignments,
    feedItemCategoryAssignments,
    feedItemTagAssignments,
    update: (table: unknown) => ({
      set: (patch: CapturedRow) => {
        updates.push({ table: tableName(table), patch });
        return {
          where: () => Promise.resolve(),
        };
      },
    }),
    delete: (table: unknown) => ({
      where: () => {
        deletes.push(tableName(table));
        return Promise.resolve();
      },
    }),
    insert: (table: unknown) => ({
      values: (input: CapturedRow | CapturedRow[]) => {
        const rows = Array.isArray(input) ? input : [input];
        const name = tableName(table);
        if (name === "categories") {
          categories.push(...rows);
          return {
            onConflictDoUpdate: () =>
              promiseQuery(rows.map((row) => ({ id: row.id as string, slug: row.slug as string }))),
          };
        }
        if (name === "feed_items") {
          feedItems.push(...rows);
        } else if (name === "feed_category_assignments") {
          feedCategoryAssignments.push(...rows);
        } else if (name === "feed_item_category_assignments") {
          feedItemCategoryAssignments.push(...rows);
        } else if (name === "feed_item_tag_assignments") {
          feedItemTagAssignments.push(...rows);
        }
        return {
          onConflictDoUpdate: () => promiseQuery([]),
        };
      },
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () => {
            if (tableName(table) === "feed_category_assignments") {
              return Promise.resolve(
                feedCategoryAssignments.filter((row) => row.provenance === "feed").slice(0, 1),
              );
            }
            return Promise.resolve([feed]);
          },
        }),
      }),
    }),
    transaction: async (callback: (tx: unknown) => Promise<void>) => callback(db),
  };

  return db;
}

export function labelsForAssignments(
  assignments: CapturedRow[],
  categories: CapturedRow[],
): string[] {
  return assignments.map((assignment) => {
    const category = categories.find((row) => row.id === assignment.categoryId);
    return category?.label as string;
  });
}
