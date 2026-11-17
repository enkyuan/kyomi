import { afterEach, describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { getTableName } from "drizzle-orm";
import { embeddingModelInfo, type EmbeddingClassifierConfig } from "@kyomi/ingest";
import { reclassifyExtractedFeedItem } from "@modules/articles/reader/extraction/reclassify";
import type { ArticleDetailDto } from "@modules/articles/types";
import { fakeDb, recordingLogger } from "@api-tests/support/layers";
import { FAKE_CATEGORY_MODEL } from "../../feeds/refresh/fake-category-model";

const EMBEDDING_MODEL_ID = embeddingModelInfo({
  apiKey: "test-key",
  apiUrl: "http://127.0.0.1/embed",
  categoryModel: FAKE_CATEGORY_MODEL,
}).modelId;

/**
 * A real embeddings endpoint on a loopback port. The embeddings client lives in `@kyomi/ingest`
 * (plain `fetch`, no injection point), so the test points `apiUrl` at this server rather than
 * patching `globalThis.fetch`.
 */
type EmbeddingsRequest = { input: string[] };
const servers: Array<{ stop: (closeActiveConnections?: boolean) => void }> = [];

function embeddingsWorker(
  respond: (body: EmbeddingsRequest) => Response = (body) => embeddingsResponse(body, UNIT_X),
) {
  const requests: EmbeddingsRequest[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      const body = (await request.json()) as EmbeddingsRequest;
      requests.push(body);
      return respond(body);
    },
  });
  servers.push(server);
  const config: EmbeddingClassifierConfig = {
    apiKey: "test-key",
    apiUrl: `http://127.0.0.1:${server.port}/embed`,
    categoryModel: FAKE_CATEGORY_MODEL,
  };
  return { requests, config };
}

function embeddingsResponse(body: EmbeddingsRequest, vector: number[]) {
  return new Response(
    JSON.stringify({ data: body.input.map((_, index) => ({ embedding: vector, index })) }),
    { status: 200 },
  );
}

function reclassify(
  db: ReturnType<typeof createCategoryDb>,
  text: string,
  config?: EmbeddingClassifierConfig,
  target: ArticleDetailDto = article(),
) {
  const logs = recordingLogger();
  const run = Effect.runPromise(
    reclassifyExtractedFeedItem(target, text, config).pipe(
      Effect.provide(Layer.mergeAll(fakeDb(db as never), logs.layer)),
    ),
  );
  return run.then(() => logs);
}

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
    imageUrl: null,
    publishedAt: "2026-07-05T00:00:00.000Z",
    feedId: "feed-1",
    feedUrl: "https://example.com/feed.xml",
    feedSiteUrl: "https://example.com",
    feedTitle: "Example Engineering",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    lastViewedAt: null,
    readingProgress: null,
    readingPosition: null,
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

afterEach(() => {
  for (const server of servers.splice(0)) {
    server.stop(true);
  }
});

describe("reclassifyExtractedFeedItem", () => {
  test("writes keyword item rows when embedding classification is not configured", async () => {
    const fake = createCategoryDb();

    await reclassify(
      fake,
      "The new open weights language model uses transformer layers, embeddings, and agent training data.",
      undefined,
      article({ title: "Release notes", link: "https://example.com/release-notes" }),
    );

    expect(fake.deletes).toEqual(["feed_item_category_assignments"]);
    expect(fake.categories.map((row) => row.label)).toEqual(["AI & ML"]);
    expect(fake.feedItemCategoryAssignments).toMatchObject([
      {
        feedItemId: "item-1",
        provenance: "classifier",
        modelId: "keyword-v1",
        taxonomyVersion: "v1",
        classifierMethod: "keyword",
      },
    ]);
  });

  test("classifies extracted text and writes keyword plus embedding item rows", async () => {
    const fake = createCategoryDb();
    const worker = embeddingsWorker();

    await reclassify(
      fake,
      "Extracted full text about compilers, build systems, and package managers.",
      worker.config,
    );

    expect(worker.requests[0]?.input[0]).toContain("Extracted full text");
    expect(fake.deletes).toEqual([
      "feed_item_category_assignments",
      "feed_item_category_assignments",
    ]);
    expect(fake.categories.map((row) => row.label)).toEqual([
      "Software Engineering",
      "Software Engineering",
    ]);
    expect(fake.feedItemCategoryAssignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          feedItemId: "item-1",
          provenance: "classifier",
          modelId: "keyword-v1",
          taxonomyVersion: "v1",
          classifierMethod: "keyword",
        }),
        expect.objectContaining({
          feedItemId: "item-1",
          provenance: "classifier",
          modelId: EMBEDDING_MODEL_ID,
          taxonomyVersion: "v1",
          classifierMethod: "embedding",
        }),
      ]),
    );
  });

  test("keeps existing item rows when extracted text yields no categories", async () => {
    const existing = [
      { id: "keyword-1", feedItemId: "item-1", provenance: "classifier", modelId: "keyword-v1" },
      {
        id: "embedding-1",
        feedItemId: "item-1",
        provenance: "classifier",
        modelId: EMBEDDING_MODEL_ID,
      },
    ];
    const fake = createCategoryDb({ existingAssignments: existing });
    const worker = embeddingsWorker((body) => embeddingsResponse(body, ORTHOGONAL_Z));

    await reclassify(
      fake,
      "Thanks for reading. Leave a comment below.",
      worker.config,
      article({ title: "Weekly notes", link: "https://example.com/weekly-notes" }),
    );

    expect(fake.deletes).toEqual([]);
    expect(fake.categories).toEqual([]);
    expect(fake.feedItemCategoryAssignments).toEqual(existing);
  });

  test("keeps existing item rows when every category is already an explicit label", async () => {
    const existing = [
      { id: "keyword-1", feedItemId: "item-1", provenance: "classifier", modelId: "keyword-v1" },
      {
        id: "embedding-1",
        feedItemId: "item-1",
        provenance: "classifier",
        modelId: EMBEDDING_MODEL_ID,
      },
    ];
    const fake = createCategoryDb({
      explicitLabels: ["Software Engineering"],
      existingAssignments: existing,
    });
    const worker = embeddingsWorker();

    await reclassify(
      fake,
      "Extracted full text about compilers, build systems, and package managers.",
      worker.config,
    );

    expect(fake.deletes).toEqual([]);
    expect(fake.categories).toEqual([]);
    expect(fake.feedItemCategoryAssignments).toEqual(existing);
  });

  test("embeds only the opening of long extracted text", async () => {
    const fake = createCategoryDb();
    const worker = embeddingsWorker();

    await reclassify(
      fake,
      `Compilers and build systems. ${"Body text. ".repeat(1_000)}Subscribe to our newsletter.`,
      worker.config,
    );

    const inputs = worker.requests.flatMap((request) => request.input);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toStartWith("Compiler maintainers rewrite package manager");
    expect(inputs[0]!.length).toBeLessThanOrEqual(4_000);
    expect(inputs[0]).not.toContain("Subscribe to our newsletter");
  });

  test("clears classifier item rows without calling the embeddings Worker when explicit labels fill the chip slots", async () => {
    const fake = createCategoryDb({ explicitLabels: ["AI & ML", "Business & Startups"] });
    const worker = embeddingsWorker();

    await reclassify(fake, "Extracted full text", worker.config);

    expect(worker.requests).toEqual([]);
    expect(fake.deletes).toEqual([
      "feed_item_category_assignments",
      "feed_item_category_assignments",
    ]);
    expect(fake.categories).toEqual([]);
    expect(fake.feedItemCategoryAssignments).toEqual([]);
  });

  test("preserves existing item rows when embedding classification fails", async () => {
    const existing = {
      id: "assignment-1",
      feedItemId: "item-1",
      provenance: "classifier",
      modelId: EMBEDDING_MODEL_ID,
    };
    const fake = createCategoryDb({ existingAssignments: [existing] });
    const worker = embeddingsWorker(() => new Response("temporary outage", { status: 503 }));

    const logs = await reclassify(fake, "Extracted full text", worker.config);

    expect(fake.deletes).toEqual(["feed_item_category_assignments"]);
    expect(fake.feedItemCategoryAssignments).toEqual(
      expect.arrayContaining([
        existing,
        expect.objectContaining({
          feedItemId: "item-1",
          provenance: "classifier",
          modelId: "keyword-v1",
          taxonomyVersion: "v1",
          classifierMethod: "keyword",
        }),
      ]),
    );
    expect(logs.entries).toMatchObject([
      {
        level: "warn",
        event: "articles.extract_full_text.categories_reclassify_failed",
        context: { articleId: "item-1", classifierMethod: "embedding" },
      },
    ]);
  });

  test("a failing label write is logged and does not fail the extraction", async () => {
    const fake = createCategoryDb();
    const failing = {
      ...fake,
      delete: () => ({ where: () => Promise.reject(new Error("deadlock detected")) }),
    };

    const logs = await reclassify(failing as never, "Extracted full text about compilers.");

    expect(logs.entries).toMatchObject([
      {
        level: "warn",
        event: "articles.extract_full_text.categories_reclassify_failed",
        context: { articleId: "item-1", classifierMethod: "keyword" },
      },
    ]);
  });
});
