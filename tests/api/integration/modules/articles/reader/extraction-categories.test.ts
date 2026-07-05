import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getTableName } from "drizzle-orm";
import { resetPrototypeCache, type EmbeddingClassifierConfig } from "@kyomi/worker";
import { reclassifyExtractedFeedItem } from "@modules/articles/reader/extraction/service";
import type { ArticleDetailDto } from "@modules/articles/types";

const originalFetch = globalThis.fetch;
const FAKE_CONFIG: EmbeddingClassifierConfig = {
  apiKey: "test-key",
  apiUrl: "https://fake.voyage.test/v1/embeddings",
};

const UNIT_X = [1, 0, 0];
const ORTHOGONAL_Z = [0, 0, 1];

type CapturedRow = Record<string, unknown>;

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

function article(overrides: Partial<ArticleDetailDto> = {}): ArticleDetailDto {
  return {
    id: "item-1",
    title: "Compiler maintainers rewrite package manager",
    link: "https://example.com/compiler-package-manager",
    summary: "Short feed summary",
    publishedAt: "2026-07-05T00:00:00.000Z",
    feedId: "feed-1",
    feedUrl: "https://example.com/feed.xml",
    feedSiteUrl: "https://example.com",
    feedTitle: "Example Engineering",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    articleType: "feed",
    categories: [],
    contentHtml: null,
    contentText: null,
    contentMarkdown: null,
    contentStatus: "ready",
    contentSource: "feed_html",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    reader: {} as ArticleDetailDto["reader"],
    ...overrides,
  };
}

function createCategoryDb(
  options: { explicitLabels?: string[]; existingAssignments?: CapturedRow[] } = {},
) {
  const deletes: string[] = [];
  const categories: CapturedRow[] = [];
  const feedItemCategoryAssignments: CapturedRow[] = [...(options.existingAssignments ?? [])];

  const db = {
    deletes,
    categories,
    feedItemCategoryAssignments,
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve((options.explicitLabels ?? []).map((label) => ({ label }))),
        }),
      }),
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
        if (name === "feed_item_category_assignments") {
          feedItemCategoryAssignments.push(...rows);
        }
        return {
          onConflictDoUpdate: () => promiseQuery([]),
        };
      },
    }),
  };

  return db;
}

beforeEach(() => {
  resetPrototypeCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetPrototypeCache();
});

describe("reclassifyExtractedFeedItem", () => {
  test("classifies extracted text and writes embedding item rows only", async () => {
    const fake = createCategoryDb();
    const itemInputs: string[] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeCall = body.input.length > 1;
      if (isPrototypeCall) {
        const embeddings = body.input.map((_, i) => (i < 4 ? UNIT_X : ORTHOGONAL_Z));
        return new Response(
          JSON.stringify({ data: embeddings.map((e, i) => ({ embedding: e, index: i })) }),
          { status: 200 },
        );
      }
      itemInputs.push(body.input[0] ?? "");
      return new Response(JSON.stringify({ data: [{ embedding: UNIT_X, index: 0 }] }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    await reclassifyExtractedFeedItem(
      fake as never,
      article(),
      "Extracted full text about compilers, build systems, and package managers.",
      { embeddingClassifier: FAKE_CONFIG },
    );

    expect(itemInputs[0]).toContain("Extracted full text");
    expect(fake.deletes).toEqual(["feed_item_category_assignments"]);
    expect(fake.categories.map((row) => row.label)).toEqual(["Software Engineering"]);
    expect(fake.feedItemCategoryAssignments).toMatchObject([
      {
        feedItemId: "item-1",
        provenance: "classifier",
        modelId: "voyage-4",
        taxonomyVersion: "v1",
        classifierMethod: "embedding",
      },
    ]);
  });

  test("clears item embedding rows without calling Voyage when explicit labels fill the chip slots", async () => {
    const fake = createCategoryDb({ explicitLabels: ["AI & ML", "Business & Startups"] });
    let fetched = false;
    globalThis.fetch = (async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;

    await reclassifyExtractedFeedItem(fake as never, article(), "Extracted full text", {
      embeddingClassifier: FAKE_CONFIG,
    });

    expect(fetched).toBe(false);
    expect(fake.deletes).toEqual(["feed_item_category_assignments"]);
    expect(fake.categories).toEqual([]);
    expect(fake.feedItemCategoryAssignments).toEqual([]);
  });

  test("preserves existing item rows when Voyage classification fails", async () => {
    const existing = {
      id: "assignment-1",
      feedItemId: "item-1",
      provenance: "classifier",
      modelId: "voyage-4",
    };
    const fake = createCategoryDb({ existingAssignments: [existing] });
    const warnings: CapturedRow[] = [];
    globalThis.fetch = (async () =>
      new Response("temporary outage", { status: 503 })) as unknown as typeof fetch;

    await reclassifyExtractedFeedItem(fake as never, article(), "Extracted full text", {
      embeddingClassifier: FAKE_CONFIG,
      logger: {
        warn: (message, data) => warnings.push({ message, ...data }),
      },
    });

    expect(fake.deletes).toEqual([]);
    expect(fake.feedItemCategoryAssignments).toEqual([existing]);
    expect(warnings).toMatchObject([
      {
        message: "articles.extract_full_text.categories_reclassify_failed",
        articleId: "item-1",
      },
    ]);
  });
});
