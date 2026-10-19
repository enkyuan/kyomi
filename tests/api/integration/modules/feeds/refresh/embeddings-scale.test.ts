import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  classifyFeedEmbedding,
  classifyItemEmbeddings,
  embedTexts,
  resetPrototypeCache,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import { FAKE_CATEGORY_MODEL } from "./fake-category-model";

const originalFetch = globalThis.fetch;
const FAKE_CONFIG: EmbeddingClassifierConfig = {
  apiKey: "test-key",
  apiUrl: "https://fake-embeddings.test/embed",
  categoryModel: FAKE_CATEGORY_MODEL,
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
  // Cosine similarity 0.35 with UNIT_X: below the default feed cutoff.
  const PARTIAL_MATCH = [0.35, Math.sqrt(1 - 0.35 ** 2), 0];
  // Halfway between Software Engineering and no category: the fake head gives it about 0.5.
  const HALF_MATCH = [1, 0, 1];
  const feedInput = {
    feedTitle: "Feed",
    feedDescription: null,
    feedUrl: "https://example.com/feed",
    feedSiteUrl: "https://example.com",
    sourceKind: "rss",
  };
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

  /**
   * Embeds every text as `itemVector`, except that with `prototypeLoadFirst` the first request
   * answers a feed's category-card prototype load.
   */
  function fakeEmbeddingsApi(
    options: { itemVector?: number[]; failRequest?: number; prototypeLoadFirst?: boolean } = {},
  ) {
    const requests: string[][] = [];
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { input: string[] };
      requests.push(body.input);
      if (requests.length === options.failRequest) {
        return new Response("rate limited", { status: 429 });
      }
      const isPrototypeLoad = options.prototypeLoadFirst === true && requests.length === 1;
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

  test("embedTexts caps long texts and splits requests by total size", async () => {
    // Long articles must not add up past the provider's per-request token limit.
    const requests = fakeEmbeddingsApi();
    const texts = Array.from({ length: 40 }, (_, index) => `${index}`.padEnd(20_000, "x"));

    const vectors = await embedTexts(texts, FAKE_CONFIG);

    expect(vectors).toHaveLength(40);
    expect(requests.map((input) => input.length)).toEqual([33, 7]);
    for (const input of requests) {
      expect(input.reduce((chars, text) => chars + text.length, 0)).toBeLessThanOrEqual(200_000);
      expect(input.every((text) => text.length < 6_100 && text.includes("[truncated]"))).toBe(true);
    }
  });

  test("embedTexts keeps capped text valid UTF-16 at both cuts", async () => {
    const requests = fakeEmbeddingsApi();
    // The emoji pairs straddle the head cut (index 4,500) and the tail cut (1,500 from the end).
    const text = `${"a".repeat(4_499)}😀${"b".repeat(2_000)}😀${"c".repeat(1_499)}`;

    await embedTexts([text], FAKE_CONFIG);

    const [sent] = requests[0] ?? [];
    expect(sent).toContain("[truncated]");
    expect(sent).not.toMatch(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,
    );
  });

  test("classifyItemEmbeddings keeps the results of requests that succeed", async () => {
    // Request 1 embeds items 0-127, request 2 items 128-129.
    fakeEmbeddingsApi({ failRequest: 2 });

    const results = await classifyItemEmbeddings(batchInputs(130), FAKE_CONFIG);

    expect(results.size).toBe(128);
    expect(results.get("item-0")?.categories[0]?.label).toBe("Software Engineering");
    expect(results.has("item-128")).toBe(false);
    expect(results.has("item-129")).toBe(false);
  });

  test("classifyItemEmbeddings throws when every request fails", async () => {
    fakeEmbeddingsApi({ failRequest: 1 });

    await expect(classifyItemEmbeddings(batchInputs(3), FAKE_CONFIG)).rejects.toThrow(/429/);
  });

  test("classifyItemEmbeddings applies itemMinProbability", async () => {
    fakeEmbeddingsApi({ itemVector: HALF_MATCH });

    const strict = await classifyItemEmbeddings(batchInputs(1), {
      ...FAKE_CONFIG,
      itemMinProbability: 0.6,
    });
    const lenient = await classifyItemEmbeddings(batchInputs(1), {
      ...FAKE_CONFIG,
      itemMinProbability: 0.4,
    });

    expect(strict.get("item-0")?.categories).toEqual([]);
    expect(lenient.get("item-0")?.categories.map((category) => category.label)).toEqual([
      "Software Engineering",
    ]);
  });

  test("classifyFeedEmbedding uses the feed threshold, not the item threshold", async () => {
    fakeEmbeddingsApi({ itemVector: PARTIAL_MATCH, prototypeLoadFirst: true });

    const itemKnobOnly = await classifyFeedEmbedding(feedInput, {
      ...FAKE_CONFIG,
      itemMinProbability: 0.01,
    });
    const feedKnob = await classifyFeedEmbedding(feedInput, {
      ...FAKE_CONFIG,
      feedSimilarityThreshold: 0.3,
    });

    expect(itemKnobOnly.categories).toEqual([{ label: "Miscellaneous", confidence: 0.1 }]);
    expect(feedKnob.categories.map((category) => category.label)).toEqual(["Software Engineering"]);
  });

  test("callers with different timeouts share one prototype load", async () => {
    const requests = fakeEmbeddingsApi({ prototypeLoadFirst: true });

    await classifyFeedEmbedding(feedInput, { ...FAKE_CONFIG, timeoutMs: 8_000 });
    await classifyFeedEmbedding(feedInput, FAKE_CONFIG);

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
      classifyFeedEmbedding(feedInput, { ...FAKE_CONFIG, timeoutMs: 10 }),
    ).rejects.toThrow(/not ready within 10ms/);
    releasePrototypes();
    const result = await classifyFeedEmbedding(feedInput, FAKE_CONFIG);

    expect(prototypeLoads).toBe(1);
    expect(result.categories[0]?.label).toBe("Software Engineering");
  });
});
