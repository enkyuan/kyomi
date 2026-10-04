import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  classifyFeedEmbedding,
  classifyItemEmbedding,
  classifyItemEmbeddings,
  embedTexts,
  resetPrototypeCache,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";

const originalFetch = globalThis.fetch;
const FAKE_CONFIG: EmbeddingClassifierConfig = {
  apiKey: "test-key",
  apiUrl: "https://fake.voyage.test/v1/embeddings",
};
const UNIT_X = [1, 0, 0];
const ORTHOGONAL_Z = [0, 0, 1];

beforeEach(() => {
  resetPrototypeCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetPrototypeCache();
});

describe("embedding requests at scale", () => {
  // Cosine similarity 0.5 with UNIT_X: below the default 0.6 cutoff.
  const PARTIAL_MATCH = [0.5, Math.sqrt(0.75), 0];
  const itemInput = {
    feedTitle: "Feed",
    feedDescription: null,
    feedUrl: "https://example.com/feed",
    feedSiteUrl: "https://example.com",
    sourceKind: "rss",
    itemTitle: "Some article",
    itemSummary: null,
    itemUrl: null,
  };

  /** The first request answers the prototype load; later ones embed every item as `itemVector`. */
  function fakeEmbeddingsApi(options: { itemVector?: number[]; failRequest?: number } = {}) {
    const requests: string[][] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      requests.push(body.input);
      if (requests.length === options.failRequest) {
        return new Response("rate limited", { status: 429 });
      }
      const isPrototypeLoad = requests.length === 1;
      const data = body.input.map((_, index) => ({
        embedding: isPrototypeLoad
          ? index < 4
            ? UNIT_X
            : ORTHOGONAL_Z
          : (options.itemVector ?? UNIT_X),
        index,
      }));
      return new Response(JSON.stringify({ data }), { status: 200 });
    }) as unknown as typeof fetch;
    return requests;
  }

  function batchInputs(count: number) {
    return Array.from({ length: count }, (_, index) => ({ ...itemInput, id: `item-${index}` }));
  }

  test("embedTexts sends large batches as several bounded requests", async () => {
    const requests = fakeEmbeddingsApi();
    const texts = Array.from({ length: 300 }, (_, index) => `text-${index}`);

    const vectors = await embedTexts(texts, FAKE_CONFIG);

    expect(requests.map((input) => input.length)).toEqual([128, 128, 44]);
    expect(vectors).toHaveLength(300);
  });

  test("classifyItemEmbeddings keeps the results of requests that succeed", async () => {
    // Request 1 loads prototypes, request 2 embeds items 0-127, request 3 items 128-129.
    fakeEmbeddingsApi({ failRequest: 3 });

    const results = await classifyItemEmbeddings(batchInputs(130), FAKE_CONFIG);

    expect(results.size).toBe(128);
    expect(results.get("item-0")?.categories[0]?.label).toBe("Software Engineering");
    expect(results.has("item-128")).toBe(false);
    expect(results.has("item-129")).toBe(false);
  });

  test("classifyItemEmbeddings throws when every request fails", async () => {
    fakeEmbeddingsApi({ failRequest: 2 });

    await expect(classifyItemEmbeddings(batchInputs(3), FAKE_CONFIG)).rejects.toThrow(/429/);
  });

  test("classifyItemEmbeddings applies itemSimilarityThreshold", async () => {
    fakeEmbeddingsApi({ itemVector: PARTIAL_MATCH });

    const strict = await classifyItemEmbeddings(batchInputs(1), FAKE_CONFIG);
    const lenient = await classifyItemEmbeddings(batchInputs(1), {
      ...FAKE_CONFIG,
      itemSimilarityThreshold: 0.4,
    });

    expect(strict.get("item-0")?.categories).toEqual([]);
    expect(lenient.get("item-0")?.categories.map((category) => category.label)).toEqual([
      "Software Engineering",
    ]);
  });

  test("classifyFeedEmbedding uses the feed threshold, not the item threshold", async () => {
    fakeEmbeddingsApi({ itemVector: PARTIAL_MATCH });
    const feedInput = {
      feedTitle: "Feed",
      feedDescription: null,
      feedUrl: "https://example.com/feed",
      feedSiteUrl: "https://example.com",
      sourceKind: "rss",
    };

    const itemKnobOnly = await classifyFeedEmbedding(feedInput, {
      ...FAKE_CONFIG,
      itemSimilarityThreshold: 0.4,
    });
    const feedKnob = await classifyFeedEmbedding(feedInput, {
      ...FAKE_CONFIG,
      feedSimilarityThreshold: 0.4,
    });

    expect(itemKnobOnly.categories).toEqual([{ label: "Miscellaneous", confidence: 0.1 }]);
    expect(feedKnob.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
  });

  test("callers with different timeouts share one prototype load", async () => {
    const requests = fakeEmbeddingsApi();

    await classifyItemEmbedding(itemInput, { ...FAKE_CONFIG, timeoutMs: 8_000 });
    await classifyItemEmbedding(itemInput, FAKE_CONFIG);

    expect(requests.filter((input) => input.length > 1)).toHaveLength(1);
  });

  test("a caller that gives up leaves the prototype load warming the cache", async () => {
    let releasePrototypes!: () => void;
    const prototypesReleased = new Promise<void>((resolve) => {
      releasePrototypes = resolve;
    });
    let prototypeLoads = 0;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      const isPrototypeLoad = body.input.length > 1;
      if (isPrototypeLoad) {
        prototypeLoads += 1;
        await prototypesReleased;
      }
      const data = body.input.map((_, index) => ({
        embedding: isPrototypeLoad && index >= 4 ? ORTHOGONAL_Z : UNIT_X,
        index,
      }));
      return new Response(JSON.stringify({ data }), { status: 200 });
    }) as unknown as typeof fetch;

    await expect(
      classifyItemEmbedding(itemInput, { ...FAKE_CONFIG, timeoutMs: 10 }),
    ).rejects.toThrow(/not ready within 10ms/);
    releasePrototypes();
    const result = await classifyItemEmbedding(itemInput, FAKE_CONFIG);

    expect(prototypeLoads).toBe(1);
    expect(result.categories[0]?.label).toBe("Software Engineering");
  });
});
